import { askJevRequest, } from './client.js';
import { buildPlanRequestBody, filePathsIn, } from './plan.js';
import { buildQuestionnaireRequestBody, buildTodoRequestBody, } from './workflow.js';
import { buildFileState, buildRequestBody, formatFindingNote, isReviewablePath, requestFitsBudget, } from './model.js';
import { createJevMetrics, } from './metrics.js';
import { JevReviewQueue } from './queue.js';
import { beginTurn as beginJevTurn, clearSession, createJevState, JEV_STATUS, registerFailure, registerSuccess, rememberNote, shouldCall, statusOf, takeNotes, } from './state.js';
import { reportError } from '../report.js';
const UNKNOWN_TURN = -1;
export function createJev({ settings, resolveKey, readText, related, transport, }) {
    const state = createJevState();
    const queue = new JevReviewQueue();
    const metrics = createJevMetrics();
    const pending = new Map();
    function beginTurn(agentId, turn) {
        beginJevTurn(state, agentId, turn);
        metrics.settle(turn);
    }
    function observe(observation) {
        if (!settings.enabled || observation.changes.length === 0) {
            return;
        }
        pending.set(observation.callId, observation);
    }
    async function complete(completion) {
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
            metrics.mutation(change.path, state.turns.get(completion.agentId) ?? UNKNOWN_TURN);
            const body = await bodyFor(change, completion.cwd);
            if (body === undefined) {
                continue;
            }
            const evidence = await evidenceFor({
                cwd: completion.cwd,
                path: change.path,
                body,
            });
            const request = buildRequestBody(buildFileState({
                path: change.path,
                body,
                kind: observation.toolName,
                addedLines: change.added,
                relatedFiles: evidence.files,
                partial: evidence.partial,
            }), settings.model);
            if (!requestFitsBudget(request)) {
                continue;
            }
            queue.enqueue({
                key: change.path,
                dependencies: [change.path],
                run: (signal) => runReview({
                    signal,
                    apiKey: apiKey.key,
                    agentId: observation.agentId,
                    path: change.path,
                    request,
                }),
            });
        }
    }
    async function evidenceFor(input) {
        try {
            return await related(input);
        }
        catch (error) {
            reportError(error);
            return { files: [], partial: true };
        }
    }
    async function bodyFor(change, cwd) {
        if (change.path === '' || !isReviewablePath(change.path)) {
            return undefined;
        }
        if (change.added.length === 0) {
            return undefined;
        }
        try {
            return await readText({ path: change.path, cwd });
        }
        catch (error) {
            reportError(error);
            return undefined;
        }
    }
    async function runReview({ signal, apiKey, agentId, path, request, }) {
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
            rememberNote(state, agentId, formatFindingNote({ path, finding, model: attempt.model }));
        }
    }
    async function reviewPlan({ agentId, cwd, plan, }) {
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
            .map((finding) => formatFindingNote({ path: 'plan', finding, model: attempt.model }))
            .filter((note) => rememberNote(state, agentId, note));
    }
    function recordAttempt(attempt) {
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
    async function reviewQuestionnaire({ agentId, questions, }) {
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
            .map((finding) => formatFindingNote({
            path: 'questionnaire',
            finding,
            model: attempt.model,
        }))
            .filter((note) => rememberNote(state, agentId, note));
    }
    async function reviewTodos({ agentId, items, check, }) {
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
            .map((finding) => formatFindingNote({ path: 'todos', finding, model: attempt.model }))
            .filter((note) => rememberNote(state, agentId, note));
    }
    async function planEvidence({ cwd, plan, }) {
        const files = [];
        for (const path of filePathsIn(plan).slice(0, settings.maxRelatedFiles)) {
            try {
                const body = await readText({ path, cwd });
                if (body !== undefined) {
                    files.push({ path, body });
                }
            }
            catch (error) {
                reportError(error);
            }
        }
        return files;
    }
    async function drain(timeoutMs) {
        if (!settings.enabled) {
            return;
        }
        let timer;
        const expiration = new Promise((resolve) => {
            timer = setTimeout(resolve, timeoutMs);
        });
        try {
            await Promise.race([queue.drain(), expiration]);
        }
        catch (error) {
            reportError(error);
        }
        finally {
            if (timer !== undefined) {
                clearTimeout(timer);
            }
        }
    }
    function notesFor(agentId) {
        const notes = takeNotes(state, agentId);
        if (!settings.calibrate) {
            return notes.slice(0, settings.maxNotes);
        }
        const muted = metrics.muted();
        return notes
            .filter((note) => !muted.has(note.ruleId))
            .slice(0, settings.maxNotes);
    }
    function recordDelivered(agentId, notes) {
        metrics.delivered(notes, state.turns.get(agentId) ?? UNKNOWN_TURN);
    }
    function metricsSnapshot() {
        return metrics.snapshot();
    }
    function cancel() {
        queue.cancel();
        clearSession(state);
    }
    function status() {
        if (!settings.enabled) {
            return JEV_STATUS.noKey;
        }
        return statusOf(state);
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
        cancel,
        status,
    };
}
