import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCheckTracker } from './src/checks/tracker.js';
import { normalizeConfig } from './src/config.js';
import { stringArgument } from './src/dsh/arguments.js';
import { mutationInspectionOf, readFileText, workingDirectoryOf, } from './src/dsh/execution.js';
import { ASK_USER_QUESTION_TOOL, EXIT_PLAN_MODE_TOOL, TODO_WRITE_TOOL, isShellTool, } from './src/dsh/tool-names.js';
import { createGuides } from './src/guidelines/guides.js';
import { createGuidelinesTool } from './src/guidelines/tool.js';
import { createFetchTransport } from './src/jev/client.js';
import { createJevCommand } from './src/jev/command.js';
import { createRelatedSource, } from './src/jev/context.js';
import { createJev } from './src/jev/index.js';
import { createKeyResolver } from './src/jev/key.js';
import { formatJevNotes } from './src/jev/model.js';
import { formatPlanNotes } from './src/jev/plan.js';
import { completedItems, formatTodoNotes, formatQuestionnaireNotes, readQuestionnaire, readTodoList, } from './src/jev/workflow.js';
import { isMutationCall } from './src/mutations/changes.js';
import { createMutationInspector, } from './src/mutations/inspector.js';
import { createPendingNotes, } from './src/mutations/pending-notes.js';
import { promptSections } from './src/prompt.js';
import { reportError } from './src/report.js';
import { reviewMessage, reviewText } from './src/review.js';
import { notesText } from './src/rules/report.js';
import { createSkillCatalog } from './src/skills/catalog.js';
import { createMonorepoProvider } from './src/skills/monorepo.js';
import { createRunStore } from './src/state/store.js';
export const name = 'sideroom-dsh';
export const inject = ['tools', 'systemPrompt'];
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export function apply(ctx, config) {
    const { settings, warnings } = normalizeConfig(config);
    for (const warning of warnings) {
        console.warn(`sideroom-dsh: ${warning}`);
    }
    const store = createRunStore();
    const previousTodos = new Map();
    const checks = createCheckTracker();
    const notes = createPendingNotes();
    const guides = createGuides(PACKAGE_ROOT);
    const inspector = createMutationInspector({
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
    registerCommand();
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
    ctx.on('tools/pre-execute', async (exec, next) => {
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
            }
            else if (exec.agent !== undefined
                && settings.checks.enabled
                && isShellTool(exec.name)) {
                await checks.startShell({
                    agentId: String(exec.agent.id),
                    callId: String(exec.callId),
                    cwd: workingDirectoryOf(ctx, exec),
                    commandLine: stringArgument(exec.arguments, 'command'),
                });
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
    ctx.on('agent/turn-stopping', async (payload) => {
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
            }
            catch (error) {
                reportError(error);
            }
        }
        try {
            await jev.drain(settings.jev.timeoutMs + 500);
        }
        catch (error) {
            reportError(error);
        }
        const jevNotes = jev.notesFor(agentId);
        jev.recordDelivered(agentId, jevNotes);
        const jevText = jevNotes.length > 0 ? formatJevNotes(jevNotes) : undefined;
        store.markReviewSent(agentId);
        try {
            payload.agent.steer(reviewMessage(reviewText(status, jevText)));
        }
        catch (error) {
            reportError(error);
        }
    });
    return Promise.resolve();
    async function augment({ exec, result, decision, pending, }) {
        if (decision.kind !== 'accept' || 'value' in decision) {
            return decision;
        }
        const succeeded = result.isError === false;
        const additions = [];
        if (pending !== undefined && succeeded) {
            additions.push({
                type: 'text',
                text: pending
                    .map((entry) => notesText({ notes: entry.notes, filePath: entry.target }))
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
                }
                else if (isShellTool(exec.name)) {
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
                }
                catch (error) {
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
                }
                catch (error) {
                    reportError(error);
                }
            }
            if (exec.name === TODO_WRITE_TOOL && succeeded) {
                try {
                    const nextTodos = readTodoList(exec.arguments);
                    if (nextTodos !== undefined) {
                        const completed = completedItems(previousTodos.get(agentId) ?? [], nextTodos);
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
                }
                catch (error) {
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
                }
                catch (error) {
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
    function registerCommand() {
        ctx.inject(['commands'], (commandContext) => {
            const commands = commandContext.get('commands');
            if (commands === undefined) {
                return;
            }
            commandContext.effect(() => {
                try {
                    return commands.register(createJevCommand({ report: () => jev.report() }));
                }
                catch (error) {
                    reportError(error);
                    return () => undefined;
                }
            });
        });
    }
}
function credentialsLookup(ctx) {
    return ctx.get('credentials');
}
function fileSystemPort(ctx) {
    return ctx.get('fs');
}
