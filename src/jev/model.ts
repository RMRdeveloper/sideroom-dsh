import { TEST_PATH_PATTERN } from '@/jev/patterns.js';
import { GENERAL_LANGUAGE, languageOfPath } from '@/languages.js';
import {
  GATE_RULE_ID,
  JEV_GATE_QUESTION,
  JEV_RULES,
  type JevNoulQuestion,
} from '@/jev/questions.js';

export { JEV_GATE_QUESTION, JEV_RULES } from '@/jev/questions.js';
export type { JevNoulQuestion, JevRule } from '@/jev/questions.js';

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = 'jev-latest';
export const JEV_CUTOFF = 0.8;
export const JEV_GATE_CUTOFF = 0.6;
export const MAX_STATE_BYTES = 32_000;
export const MAX_REQUEST_BYTES = 64_000;

export interface JevRelatedFile {
  path: string;
  body: string;
  relation: 'imported' | 'consumer' | 'test';
}

export interface JevFileState {
  file: {
    path: string;
    language: string;
    body: string;
  };
  change: {
    kind: string;
    addedLines: string[];
  };
  context: {
    files: JevRelatedFile[];
    partial: boolean;
  };
}

export interface JevRelatedEvidence {
  path: string;
  body: string;
}

export interface JevPlanState {
  plan: {
    text: string;
    mentionedFiles: string[];
  };
  files: JevRelatedEvidence[];
}

export interface JevQuestionnaireOption {
  label: string;
  description: string | undefined;
  recommended: boolean;
}

export interface JevQuestionnaireQuestion {
  id: string;
  header: string | undefined;
  text: string;
  options: JevQuestionnaireOption[];
  multiSelect: boolean;
}

export interface JevQuestionnaireState {
  kind: 'questionnaire';
  questions: JevQuestionnaireQuestion[];
}

export interface JevTodoCheck {
  command: string | null;
  status: string;
}

export interface JevTodoState {
  kind: 'todo';
  items: string[];
  check: JevTodoCheck;
}

export interface JevRequestBody {
  model: string;
  state: JevFileState | JevPlanState | JevQuestionnaireState | JevTodoState;
  questions: Record<string, JevNoulQuestion>;
}

export interface JevFinding {
  ruleId: string;
  probability: number;
}

export interface JevNote {
  path: string;
  ruleId: string;
  probability: number;
  model: string | undefined;
}

export interface JevNoulAnswer {
  noul: number;
}

export interface JevResponseEnvelope {
  model: string | undefined;
  answers: Readonly<Record<string, JevNoulAnswer>> | undefined;
}

export function isTestPath(path: string): boolean {
  return TEST_PATH_PATTERN.test(path);
}

export function isReviewablePath(path: string): boolean {
  return languageOfPath(path) !== GENERAL_LANGUAGE;
}

export interface BuildFileStateInput {
  path: string;
  body: string;
  kind: string;
  addedLines: readonly string[];
  relatedFiles?: readonly JevRelatedFile[];
  partial?: boolean;
}

export function buildFileState({
  path,
  body,
  kind,
  addedLines,
  relatedFiles = [],
  partial = false,
}: BuildFileStateInput): JevFileState {
  return {
    file: { path, language: languageOfPath(path), body },
    change: { kind, addedLines: [...addedLines] },
    context: { files: [...relatedFiles], partial },
  };
}

export function buildRequestBody(
  state: JevFileState,
  model: string,
): JevRequestBody {
  const questions: Record<string, JevNoulQuestion> = {
    [GATE_RULE_ID]: JEV_GATE_QUESTION.question,
  };
  const hasImportedFile = state.context.files.some(
    (related) => related.relation === 'imported',
  );
  const hasConsumer = state.context.files.some(
    (related) => related.relation === 'consumer' && !isTestPath(related.path),
  );
  const hasTest
    = isTestPath(state.file.path)
      || state.context.files.some((related) => isTestPath(related.path));
  const hasProduction
    = !isTestPath(state.file.path)
      || state.context.files.some((related) => !isTestPath(related.path));
  const addedText = state.change.addedLines.join('\n');
  for (const rule of JEV_RULES) {
    if (rule.id === 'dependency-direction' && !hasImportedFile) {
      continue;
    }
    if (rule.id === 'comments' && !/(?:\/\/|\/\*|#)/u.test(addedText)) {
      continue;
    }
    if (rule.id === 'contract-compatibility' && !hasConsumer) {
      continue;
    }
    if (rule.id === 'test-quality' && (!hasTest || !hasProduction)) {
      continue;
    }
    questions[rule.id] = rule.question;
  }
  return { model, state, questions };
}

export function requestFitsBudget(request: JevRequestBody): boolean {
  const longestQuestion = Object.values(request.questions).reduce(
    (longest, question) =>
      Math.max(longest, Buffer.byteLength(JSON.stringify(question))),
    0,
  );
  return (
    Buffer.byteLength(JSON.stringify(request.state)) + longestQuestion
    <= MAX_STATE_BYTES
    && Buffer.byteLength(JSON.stringify(request)) <= MAX_REQUEST_BYTES
  );
}

export function parseEnvelope(text: string): JevResponseEnvelope | undefined {
  const payload = parseJsonObject(text);
  if (payload === undefined) {
    return undefined;
  }
  const model = typeof payload.model === 'string' ? payload.model : undefined;
  return { model, answers: readAnswers(payload.answers) };
}

export interface ReadFindingsInput {
  envelope: JevResponseEnvelope;
  asked: ReadonlySet<string>;
  cutoff: number;
  gate: number;
}

export function readGate(envelope: JevResponseEnvelope): number | undefined {
  const gate = envelope.answers?.[GATE_RULE_ID];
  if (gate === undefined || !isProbability(gate.noul)) {
    return undefined;
  }
  return gate.noul;
}

export function readFindings({
  envelope,
  asked,
  cutoff,
  gate,
}: ReadFindingsInput): JevFinding[] {
  const answers = envelope.answers;
  const gateProbability = readGate(envelope);
  if (answers === undefined || gateProbability === undefined) {
    return [];
  }
  if (gateProbability < gate) {
    return [];
  }
  const findings: JevFinding[] = [];
  for (const ruleId of asked) {
    if (ruleId === GATE_RULE_ID) {
      continue;
    }
    const answer = answers[ruleId];
    if (answer === undefined || !isProbability(answer.noul)) {
      continue;
    }
    if (answer.noul < cutoff) {
      continue;
    }
    findings.push({ ruleId, probability: answer.noul });
  }
  return findings.sort(
    (left, right) =>
      right.probability - left.probability
      || compareText(left.ruleId, right.ruleId),
  );
}

export function findingKey(path: string, ruleId: string): string {
  return `${path}#${ruleId}`;
}

export interface AdvisoryNotesInput {
  title: string;
  notes: readonly JevNote[];
  footer: string;
  includePath?: boolean;
}

export function formatAdvisoryNotes({
  title,
  notes,
  footer,
  includePath = false,
}: AdvisoryNotesInput): string {
  const model = notes.find((note) => note.model !== undefined)?.model;
  const header
    = model === undefined
      ? `Sideroom Jev ${title} (advisory, never a gate):`
      : `Sideroom Jev ${title} (model ${model}, advisory, never a gate):`;
  const lines = notes.map((note) =>
    includePath
      ? `- \`${note.path}\` [${note.ruleId}] p=${note.probability.toFixed(2)}`
      : `- [${note.ruleId}] p=${note.probability.toFixed(2)}`,
  );
  return `${header}
${lines.join('\n')}

${footer}`;
}

export function formatJevNotes(notes: readonly JevNote[]): string {
  return formatAdvisoryNotes({
    title: 'review',
    notes,
    includePath: true,
    footer:
      'Jev is a classifier over the changed code, not a reviewer. Verify each point against the loaded guide and the changed file; change the code only if the evidence confirms it. Missing context is not proof of a problem.',
  });
}

export function formatFindingNote({
  path,
  finding,
  model,
}: {
  path: string;
  finding: JevFinding;
  model: string | undefined;
}): JevNote {
  return {
    path,
    ruleId: finding.ruleId,
    probability: finding.probability,
    model,
  };
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  return parsed as Record<string, unknown>;
}

function readAnswers(
  value: unknown,
): Record<string, JevNoulAnswer> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const answers: Record<string, JevNoulAnswer> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const { noul } = entry as { noul?: unknown };
    if (typeof noul === 'number') {
      answers[id] = { noul };
    }
  }
  return answers;
}
