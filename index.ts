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
  workingDirectoryOf,
} from '@/dsh/execution.js';
import { isShellTool } from '@/dsh/tool-names.js';
import { createGuides } from '@/guidelines/guides.js';
import { createGuidelinesTool } from '@/guidelines/tool.js';
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
  const checks = createCheckTracker();
  const notes: PendingNotes = createPendingNotes();
  const guides = createGuides(PACKAGE_ROOT);
  const inspector: MutationInspector = createMutationInspector({
    settings,
    store,
    notes,
  });

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
        return augment({ exec, result, decision, pending });
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
    store.markReviewSent(agentId);
    try {
      payload.agent.steer(reviewMessage(reviewText(status)));
    } catch (error) {
      reportError(error);
    }
  });

  return Promise.resolve();

  function augment({
    exec,
    result,
    decision,
    pending,
  }: AugmentInput): PostToolDecision {
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
