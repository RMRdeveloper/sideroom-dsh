import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCheckTracker } from './src/checks/tracker.js';
import { normalizeConfig } from './src/config.js';
import { stringArgument } from './src/dsh/arguments.js';
import { mutationCallOf, workingDirectoryOf } from './src/dsh/execution.js';
import { isMutationTool, isShellTool } from './src/dsh/tool-names.js';
import { createGuides } from './src/guidelines/guides.js';
import { createGuidelinesTool } from './src/guidelines/tool.js';
import { createMutationInspector, } from './src/mutations/inspector.js';
import { createPendingNotes, } from './src/mutations/pending-notes.js';
import { promptSections } from './src/prompt.js';
import { reportError } from './src/report.js';
import { reviewText } from './src/review.js';
import { notesText } from './src/rules/report.js';
import { createSkillCatalog } from './src/skills/catalog.js';
import { createMonorepoProvider } from './src/skills/monorepo.js';
import { createRunStore } from './src/state/store.js';
export const name = 'sideroom-dsh';
export const inject = ['tools', 'systemPrompt'];
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export async function apply(ctx, config) {
    const { settings, warnings } = normalizeConfig(config);
    for (const warning of warnings) {
        console.warn(`sideroom-dsh: ${warning}`);
    }
    const store = createRunStore();
    const checks = createCheckTracker();
    const notes = createPendingNotes();
    const guides = createGuides(PACKAGE_ROOT);
    const inspector = createMutationInspector({
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
            checks.beginTurn(agentId);
        }
        notes.clear();
        return next();
    });
    ctx.on('tools/pre-execute', async (exec, next) => {
        try {
            const call = mutationCallOf(ctx, exec);
            if (call === null) {
                return next();
            }
            const denial = await inspector.inspect(call);
            if (denial !== null) {
                return denial;
            }
        }
        catch (error) {
            reportError(error);
        }
        return next();
    });
    ctx.on('tools/post-execute', async (exec, result, next) => {
        const decision = await next();
        const pending = notes.take(String(exec.callId));
        try {
            return await augment({ exec, result, decision, pending });
        }
        catch (error) {
            reportError(error);
            return decision;
        }
    });
    async function augment({ exec, result, decision, pending, }) {
        if (decision.kind !== 'accept' || 'value' in decision) {
            return decision;
        }
        const additions = [];
        if (pending !== undefined) {
            additions.push({
                type: 'text',
                text: notesText({ notes: pending.notes, filePath: pending.target }),
            });
        }
        const agentId = exec.agent === undefined ? null : String(exec.agent.id);
        const succeeded = result.isError === false;
        const mutation = isMutationTool(exec.name);
        if (agentId !== null) {
            const cwd = workingDirectoryOf(ctx, exec);
            if (settings.checks.enabled && succeeded) {
                if (mutation) {
                    checks.observeMutation(agentId);
                }
                else if (isShellTool(exec.name)) {
                    await checks.observeShell({
                        agentId,
                        cwd,
                        commandLine: stringArgument(exec.arguments, 'command'),
                    });
                }
            }
            if (settings.review.enabled &&
                mutation &&
                succeeded &&
                store.takeReview(agentId)) {
                if (settings.checks.enabled) {
                    await checks.refresh(agentId, cwd);
                }
                additions.push({
                    type: 'text',
                    text: reviewText(checks.statusOf(agentId)),
                });
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
    function registerSkills() {
        const skills = ctx.get('skills');
        if (!settings.skills.enabled || skills === undefined) {
            return;
        }
        if (settings.skills.packaged) {
            for (const skill of createSkillCatalog(PACKAGE_ROOT)) {
                ctx.effect(() => skills.register(skill));
            }
        }
        if (settings.skills.monorepo) {
            ctx.effect(() => skills.registerProvider(createMonorepoProvider(settings.skills.maxDepth)));
        }
    }
}
