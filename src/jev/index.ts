import type { JevSettings } from '@/config.js';
import {
  askJevRequest,
  type JevAttempt,
  type JevTransport,
} from '@/jev/client.js';
import type {
  RelatedSourceInput,
  RelatedSourceResult,
} from '@/jev/context.js';
import {
  buildPlanRequestBody,
  filePathsIn,
  type PlanEvidenceFile,
} from '@/jev/plan.js';
import {
  buildQuestionnaireRequestBody,
  buildTodoRequestBody,
} from '@/jev/workflow.js';
import type { JevKey } from '@/jev/key.js';
import {
  buildFileState,
  buildRequestBody,
  formatFindingNote,
  isReviewablePath,
  requestFitsBudget,
  type JevNote,
  type JevQuestionnaireQuestion,
  type JevTodoCheck,
} from '@/jev/model.js';
import {
  createJevMetrics,
  type JevMetricsSnapshot,
} from '@/jev/metrics.js';
import { JevReviewQueue } from '@/jev/queue.js';
import {
  beginTurn as beginJevTurn,
  clearSession,
  createJevState,
  registerFailure,
  registerSuccess,
  rememberNote,
  shouldCall,
  statusOf,
  takeNotes,
} from '@/jev/state.js';
import { buildJevReport, type JevReport } from '@/jev/status.js';
import type { MutationChange } from '@/mutations/changes.js';
import { reportError } from '@/report.js';

const UNKNOWN_TURN = -1;

export interface PendingMutation {
  agentId: string;
  callId: string;
  toolName: string;
  changes: readonly MutationChange[];
}

export interface JevCompletion {
  agentId: string;
  callId: string;
  cwd: string;
  succeeded: boolean;
}

export interface ReadTextInput {
  path: string;
  cwd: string;
}

export interface JevOptions {
  settings: JevSettings;
  resolveKey: () => Promise<JevKey | undefined>;
  readText: (input: ReadTextInput) => Promise<string | undefined>;
  related: (input: RelatedSourceInput) => Promise<RelatedSourceResult>;
  transport: JevTransport;
}

export interface PlanReviewInput {
  agentId: string;
  cwd: string;
  plan: string;
}

export interface QuestionnaireReviewInput {
  agentId: string;
  questions: readonly JevQuestionnaireQuestion[];
}

export interface TodoReviewInput {
  agentId: string;
  items: readonly string[];
  check: JevTodoCheck;
}

export interface Jev {
  beginTurn(agentId: string, turn: number): void;
  observe(observation: PendingMutation): void;
  complete(completion: JevCompletion): Promise<void>;
  reviewPlan(input: PlanReviewInput): Promise<JevNote[]>;
  reviewQuestionnaire(
    input: QuestionnaireReviewInput,
  ): Promise<JevNote[]>;
  reviewTodos(input: TodoReviewInput): Promise<JevNote[]>;
  drain(timeoutMs: number): Promise<void>;
  notesFor(agentId: string): JevNote[];
  recordDelivered(agentId: string, notes: readonly JevNote[]): void;
  metrics(): JevMetricsSnapshot;
  report(): Promise<JevReport>;
  cancel(): void;
}

export function createJev({
  settings,
  resolveKey,
  readText,
  related,
  transport,
}: JevOptions): Jev {
  const state = createJevState();
  const queue = new JevReviewQueue();
  const metrics = createJevMetrics();
  const pending = new Map<string, PendingMutation>();

  function beginTurn(agentId: string, turn: number): void {
    beginJevTurn(state, agentId, turn);
    metrics.settle(turn);
  }

  function observe(observation: PendingMutation): void {
    if (!settings.enabled || observation.changes.length === 0) {
      return;
    }
    pending.set(observation.callId, observation);
  }

  async function complete(completion: JevCompletion): Promise<void> {
    const observation = pending.get(completion.callId);
    pending.delete(completion.callId);
    if (!settings.enabled || !completion.succeeded || observation === undefined) {
      return;
    }
    if (!shouldCall(state)) {
      return;
    }
    const apiKey = await resolveKey();
    if (apiKey === undefined) {
      return;
    }
    for (const change of observation.changes) {
      metrics.mutation(
        change.path,
        state.turns.get(completion.agentId) ?? UNKNOWN_TURN,
      );
      const body = await bodyFor(change, completion.cwd);
      if (body === undefined) {
        continue;
      }
      const evidence = await evidenceFor({
        cwd: completion.cwd,
        path: change.path,
        body,
      });
      const request = buildRequestBody(
        buildFileState({
          path: change.path,
          body,
          kind: observation.toolName,
          addedLines: change.added,
          relatedFiles: evidence.files,
          partial: evidence.partial,
        }),
        settings.model,
      );
      if (!requestFitsBudget(request)) {
        continue;
      }
      queue.enqueue({
        key: change.path,
        dependencies: [change.path],
        run: (signal) =>
          runReview({
            signal,
            apiKey: apiKey.key,
            agentId: observation.agentId,
            path: change.path,
            request,
          }),
      });
    }
  }

  async function evidenceFor(input: RelatedSourceInput): Promise<RelatedSourceResult> {
    try {
      return await related(input);
    } catch (error) {
      reportError(error);
      return { files: [], partial: true };
    }
  }

  async function bodyFor(
    change: MutationChange,
    cwd: string,
  ): Promise<string | undefined> {
    if (change.path === '' || !isReviewablePath(change.path)) {
      return undefined;
    }
    if (change.added.length === 0) {
      return undefined;
    }
    try {
      return await readText({ path: change.path, cwd });
    } catch (error) {
      reportError(error);
      return undefined;
    }
  }

  async function runReview({
    signal,
    apiKey,
    agentId,
    path,
    request,
  }: {
    signal: AbortSignal;
    apiKey: string;
    agentId: string;
    path: string;
    request: ReturnType<typeof buildRequestBody>;
  }): Promise<void> {
    if (!shouldCall(state) || signal.aborted) {
      return;
    }
    state.calls += 1;
    const attempt = await askJevRequest({
      transport,
      apiKey,
      requestBody: request,
      cutoff: settings.cutoff,
      gate: settings.gate,
      signal,
    });
    if (signal.aborted) {
      return;
    }
    if (!recordAttempt(attempt)) {
      return;
    }
    for (const finding of attempt.findings ?? []) {
      rememberNote(
        state,
        agentId,
        formatFindingNote({ path, finding, model: attempt.model }),
      );
    }
  }

  async function reviewPlan({
    agentId,
    cwd,
    plan,
  }: PlanReviewInput): Promise<JevNote[]> {
    if (!settings.enabled || !settings.reviewPlans || !shouldCall(state)) {
      return [];
    }
    const apiKey = await resolveKey();
    if (apiKey === undefined) {
      return [];
    }
    const files = await planEvidence({ cwd, plan });
    const request = buildPlanRequestBody({ plan, files, model: settings.model });
    if (!requestFitsBudget(request)) {
      return [];
    }
    state.calls += 1;
    const attempt = await askJevRequest({
      transport,
      apiKey: apiKey.key,
      requestBody: request,
      cutoff: settings.cutoff,
      gate: settings.gate,
    });
    if (!recordAttempt(attempt)) {
      return [];
    }
    return (attempt.findings ?? [])
      .map((finding) =>
        formatFindingNote({ path: 'plan', finding, model: attempt.model }),
      )
      .filter((note) => rememberNote(state, agentId, note));
  }

  function recordAttempt(attempt: JevAttempt): boolean {
    if (attempt.failure !== undefined) {
      registerFailure(state, attempt.failure);
      return false;
    }
    registerSuccess(state);
    if (attempt.model !== undefined) {
      state.lastModel = attempt.model;
    }
    return true;
  }

  async function reviewQuestionnaire({
    agentId,
    questions,
  }: QuestionnaireReviewInput): Promise<JevNote[]> {
    if (!settings.enabled || !settings.reviewWorkflows || !shouldCall(state)) {
      return [];
    }
    const apiKey = await resolveKey();
    if (apiKey === undefined) {
      return [];
    }
    const request = buildQuestionnaireRequestBody({
      questions,
      model: settings.model,
    });
    if (!requestFitsBudget(request)) {
      return [];
    }
    state.calls += 1;
    const attempt = await askJevRequest({
      transport,
      apiKey: apiKey.key,
      requestBody: request,
      cutoff: settings.cutoff,
      gate: settings.gate,
    });
    if (!recordAttempt(attempt)) {
      return [];
    }
    return (attempt.findings ?? [])
      .map((finding) =>
        formatFindingNote({
          path: 'questionnaire',
          finding,
          model: attempt.model,
        }),
      )
      .filter((note) => rememberNote(state, agentId, note));
  }

  async function reviewTodos({
    agentId,
    items,
    check,
  }: TodoReviewInput): Promise<JevNote[]> {
    if (!settings.enabled || !settings.reviewWorkflows || !shouldCall(state)) {
      return [];
    }
    const apiKey = await resolveKey();
    if (apiKey === undefined) {
      return [];
    }
    const request = buildTodoRequestBody({ items, check, model: settings.model });
    if (!requestFitsBudget(request)) {
      return [];
    }
    state.calls += 1;
    const attempt = await askJevRequest({
      transport,
      apiKey: apiKey.key,
      requestBody: request,
      cutoff: settings.cutoff,
      gate: settings.gate,
    });
    if (!recordAttempt(attempt)) {
      return [];
    }
    return (attempt.findings ?? [])
      .map((finding) =>
        formatFindingNote({ path: 'todos', finding, model: attempt.model }),
      )
      .filter((note) => rememberNote(state, agentId, note));
  }

  async function planEvidence({
    cwd,
    plan,
  }: {
    cwd: string;
    plan: string;
  }): Promise<PlanEvidenceFile[]> {
    const files: PlanEvidenceFile[] = [];
    for (const path of filePathsIn(plan).slice(0, settings.maxRelatedFiles)) {
      try {
        const body = await readText({ path, cwd });
        if (body !== undefined) {
          files.push({ path, body });
        }
      } catch (error) {
        reportError(error);
      }
    }
    return files;
  }

  async function drain(timeoutMs: number): Promise<void> {
    if (!settings.enabled) {
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    const expiration = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([queue.drain(), expiration]);
    } catch (error) {
      reportError(error);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  function notesFor(agentId: string): JevNote[] {
    const notes = takeNotes(state, agentId);
    if (!settings.calibrate) {
      return notes.slice(0, settings.maxNotes);
    }
    const muted = metrics.muted();
    return notes
      .filter((note) => !muted.has(note.ruleId))
      .slice(0, settings.maxNotes);
  }

  function recordDelivered(
    agentId: string,
    notes: readonly JevNote[],
  ): void {
    metrics.delivered(notes, state.turns.get(agentId) ?? UNKNOWN_TURN);
  }

  function metricsSnapshot(): JevMetricsSnapshot {
    return metrics.snapshot();
  }

  function cancel(): void {
    queue.cancel();
    clearSession(state);
  }

  async function report(): Promise<JevReport> {
    return buildJevReport({
      enabled: settings.enabled,
      keyEnv: settings.keyEnv,
      key: await resolveKey(),
      model: settings.model,
      cutoff: settings.cutoff,
      gate: settings.gate,
      runtime: statusOf(state),
      calls: state.calls,
      muted: settings.calibrate ? [...metrics.muted()] : [],
    });
  }

  return {
    beginTurn,
    observe,
    complete,
    reviewPlan,
    reviewQuestionnaire,
    reviewTodos,
    drain,
    notesFor,
    recordDelivered,
    metrics: metricsSnapshot,
    report,
    cancel,
  };
}
