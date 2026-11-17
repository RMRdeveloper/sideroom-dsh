import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from '@deepseek-ai/cordis';
import type {
  PostToolDecision,
  PreToolDecision,
  ToolExecution,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools';
import type {
  SkillProvider,
  SkillProviderControl,
  SkillRegistration,
} from '@deepseek-ai/dsh-skill';
import { createCheckTracker } from '@/checks/tracker.js';
import { normalizeConfig } from '@/config.js';
import { stringArgument } from '@/dsh/arguments.js';
import {
  mutationInspectionOf,
  readFileText,
  workingDirectoryOf,
} from '@/dsh/execution.js';
import {
  ASK_USER_QUESTION_TOOL,
  EXIT_PLAN_MODE_TOOL,
  TODO_WRITE_TOOL,
  isShellTool,
} from '@/dsh/tool-names.js';
import { createGuides } from '@/guidelines/guides.js';
import { createGuidelinesTool } from '@/guidelines/tool.js';
import { createFetchTransport } from '@/jev/client.js';
import {
  createRelatedSource,
  type RelatedFileSystem,
} from '@/jev/context.js';
import { createJev } from '@/jev/index.js';
import { createKeyResolver, type CredentialLookup } from '@/jev/key.js';
import { formatJevNotes } from '@/jev/model.js';
import { formatPlanNotes } from '@/jev/plan.js';
import {
  completedItems,
  formatTodoNotes,
  formatQuestionnaireNotes,
  readQuestionnaire,
  readTodoList,
} from '@/jev/workflow.js';
import { isMutationCall } from '@/mutations/changes.js';
import {
  createMutationInspector,
  type MutationInspector,
} from '@/mutations/inspector.js';
import {
  createPendingNotes,
  type PendingNote,
  type PendingNotes,
} from '@/mutations/pending-notes.js';
import { promptSections } from '@/prompt.js';
import { reportError } from '@/report.js';
import { reviewMessage, reviewText } from '@/review.js';
import { notesText } from '@/rules/report.js';
import { createSkillCatalog } from '@/skills/catalog.js';
import { createMonorepoProvider } from '@/skills/monorepo.js';
import { createRunStore } from '@/state/store.js';

export const name = 'sideroom-dsh';

export const inject = ['tools', 'systemPrompt'];

interface SkillsService {
  register(skill: SkillRegistration): () => void;
  registerProvider(
    create: (control: SkillProviderControl) => SkillProvider
  ): () => void;
}

interface TextBlock {
  type: 'text';
  text: string;
}

interface AugmentInput {
  exec: ToolExecution;
  result: Readonly<ToolExecutionResult>;
  decision: PostToolDecision;
  pending: PendingNote[] | undefined;
}

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function apply(ctx: Context, config: unknown): Promise<void> {
  const { settings, warnings } = normalizeConfig(config);
  for (const warning of warnings) {
    console.warn(`sideroom-dsh: ${warning}`);
  }

  const store = createRunStore();
  const previousTodos = new Map<string, ReturnType<typeof readTodoList>>();
  const checks = createCheckTracker();
  const notes: PendingNotes = createPendingNotes();
  const guides = createGuides(PACKAGE_ROOT);
  const inspector: MutationInspector = createMutationInspector({
    settings,
    store,
    notes,
  });
  const relatedSource = createRelatedSource({
    fs: fileSystemPort(ctx),
    settings: {
      maxFiles: settings.jev.maxRelatedFiles,
      scanForConsumers: settings.jev.scanForConsumers,
    },
  });
  const jev = createJev({
    settings: settings.jev,
    resolveKey: createKeyResolver({
      environment: process.env,
      envName: settings.jev.keyEnv,
      credentials: credentialsLookup(ctx),
    }),
    readText: ({ path, cwd }) => readFileText(ctx, cwd, path),
    related: (input) => relatedSource.collect(input),
    transport: createFetchTransport({
      endpoint: settings.jev.endpoint,
      timeoutMs: settings.jev.timeoutMs,
    }),
  });

  ctx.effect(() => jev.cancel);
  ctx.effect(() => ctx.tools.register(createGuidelinesTool({ guides, store })));

  for (const section of promptSections(settings.prompt)) {
    ctx.effect(() => ctx.systemPrompt.section(section));
  }

  registerSkills();

  ctx.on('agent/pre-step', (payload, next) => {
    if (payload?.agent !== undefined) {
      const agentId = String(payload.agent.id);
      store.beginTurn(agentId, payload.turn);
      checks.beginTurn(agentId, payload.turn);
      jev.beginTurn(agentId, payload.turn);
    }
    notes.clear();
    return next();
  });

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    try {
      const inspection = await mutationInspectionOf(ctx, exec);
      if (inspection !== null) {
        const denial = await inspector.inspect(inspection);
        if (denial !== null) {
          return denial;
        }
        if (settings.review.enabled) {
          jev.observe({
            agentId: inspection.agentId,
            callId: inspection.callId,
            toolName: inspection.toolName,
            changes: inspection.changes,
          });
        }
      } else if (
        exec.agent !== undefined
        && settings.checks.enabled
        && isShellTool(exec.name)
      ) {
        await checks.startShell({
          agentId: String(exec.agent.id),
          callId: String(exec.callId),
          cwd: workingDirectoryOf(ctx, exec),
          commandLine: stringArgument(exec.arguments, 'command'),
        });
      }
    } catch (error) {
      reportError(error);
    }
    return next();
  });

  ctx.on(
    'tools/post-execute',
    async (
      exec,
      result: Readonly<ToolExecutionResult>,
      next,
    ): Promise<PostToolDecision> => {
      const decision = await next();
      const pending = notes.take(String(exec.callId));
      try {
        return await augment({ exec, result, decision, pending });
      } catch (error) {
        reportError(error);
        return decision;
      }
    },
  );

  ctx.on('agent/turn-stopping', async (payload): Promise<void> => {
    const agentId = String(payload.agent.id);
    const pending = store.pendingReview(agentId);
    if (pending === null || payload.signal.aborted) {
      return;
    }
    let status = checks.statusOf(agentId, pending.cwd);
    if (settings.checks.enabled) {
      try {
        await checks.refresh(agentId, pending.cwd);
        status = checks.statusOf(agentId, pending.cwd);
      } catch (error) {
        reportError(error);
      }
    }
    try {
      await jev.drain(settings.jev.timeoutMs + 500);
    } catch (error) {
      reportError(error);
    }
    const jevNotes = jev.notesFor(agentId);
    jev.recordDelivered(agentId, jevNotes);
    const jevText = jevNotes.length > 0 ? formatJevNotes(jevNotes) : undefined;
    store.markReviewSent(agentId);
    try {
      payload.agent.steer(reviewMessage(reviewText(status, jevText)));
    } catch (error) {
      reportError(error);
    }
  });

  return Promise.resolve();

  async function augment({
    exec,
    result,
    decision,
    pending,
  }: AugmentInput): Promise<PostToolDecision> {
    if (decision.kind !== 'accept' || 'value' in decision) {
      return decision;
    }
    const succeeded = result.isError === false;
    const additions: TextBlock[] = [];
    if (pending !== undefined && succeeded) {
      additions.push({
        type: 'text',
        text: pending
          .map((entry) =>
            notesText({ notes: entry.notes, filePath: entry.target }),
          )
          .join('\n\n'),
      });
    }

    const agentId = exec.agent === undefined ? null : String(exec.agent.id);
    if (agentId !== null) {
      const cwd = workingDirectoryOf(ctx, exec);
      const mutation = isMutationCall(exec.name, exec.arguments);
      if (settings.checks.enabled) {
        if (mutation) {
          if (succeeded) {
            checks.observeMutation(agentId, cwd);
          }
        } else if (isShellTool(exec.name)) {
          checks.observeShell({
            agentId,
            callId: String(exec.callId),
            cwd,
            succeeded,
          });
        }
      }
      if (settings.review.enabled && mutation && succeeded) {
        store.armReview(agentId, cwd);
      }
      if (settings.review.enabled && mutation && succeeded) {
        try {
          await jev.complete({
            agentId,
            callId: String(exec.callId),
            cwd,
            succeeded,
          });
        } catch (error) {
          reportError(error);
        }
      }
      if (exec.name === ASK_USER_QUESTION_TOOL && succeeded) {
        try {
          const questions = readQuestionnaire(exec.arguments);
          if (questions !== undefined) {
            const questionnaireNotes = await jev.reviewQuestionnaire({
              agentId,
              questions,
            });
            if (questionnaireNotes.length > 0) {
              additions.push({
                type: 'text',
                text: formatQuestionnaireNotes(questionnaireNotes),
              });
            }
          }
        } catch (error) {
          reportError(error);
        }
      }
      if (exec.name === TODO_WRITE_TOOL && succeeded) {
        try {
          const nextTodos = readTodoList(exec.arguments);
          if (nextTodos !== undefined) {
            const completed = completedItems(
              previousTodos.get(agentId) ?? [],
              nextTodos,
            );
            previousTodos.set(agentId, nextTodos);
            const check = checks.outcomeOf(agentId, cwd);
            if (completed.length > 0 && check.status === 'failed') {
              const todoNotes = await jev.reviewTodos({
                agentId,
                items: completed,
                check,
              });
              if (todoNotes.length > 0) {
                additions.push({ type: 'text', text: formatTodoNotes(todoNotes) });
              }
            }
          }
        } catch (error) {
          reportError(error);
        }
      }
      if (exec.name === EXIT_PLAN_MODE_TOOL && succeeded) {
        try {
          const planText = stringArgument(exec.arguments, 'plan');
          if (planText.trim() !== '') {
            const planNotes = await jev.reviewPlan({
              agentId,
              cwd,
              plan: planText,
            });
            if (planNotes.length > 0) {
              additions.push({
                type: 'text',
                text: formatPlanNotes(planNotes),
              });
            }
          }
        } catch (error) {
          reportError(error);
        }
      }
    }

    if (additions.length === 0) {
      return decision;
    }
    return {
      kind: 'accept',
      content: [...(decision.content ?? result.content ?? []), ...additions],
    };
  }

  function registerSkills(): void {
    const skills = ctx.get('skills') as SkillsService | undefined;
    if (!settings.skills.enabled || skills === undefined) {
      return;
    }
    if (settings.skills.packaged) {
      for (const skill of createSkillCatalog(PACKAGE_ROOT)) {
        ctx.effect(() => skills.register(skill));
      }
    }
    if (settings.skills.monorepo) {
      ctx.effect(() =>
        skills.registerProvider(
          createMonorepoProvider(settings.skills.maxDepth),
        ),
      );
    }
  }
}

function credentialsLookup(ctx: Context): CredentialLookup | undefined {
  return ctx.get('credentials') as CredentialLookup | undefined;
}

function fileSystemPort(ctx: Context): RelatedFileSystem | undefined {
  return ctx.get('fs') as RelatedFileSystem | undefined;
}
