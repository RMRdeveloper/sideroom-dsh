import { findingKey } from './model.js';
export const JEV_TRANSIENT_FAILURE_LIMIT = 3;
export const JEV_STATUS = {
    ready: 'ready',
    noKey: 'noKey',
    quota: 'quota',
    auth: 'auth',
    rateLimited: 'rateLimited',
    unavailable: 'unavailable',
};
export function createJevState() {
    return {
        halted: undefined,
        transientFailures: 0,
        rateLimitedThisTurn: false,
        lastModel: undefined,
        calls: 0,
        turns: new Map(),
        noted: new Map(),
        notes: new Map(),
    };
}
export function beginTurn(state, agentId, turn) {
    if (state.turns.get(agentId) === turn) {
        return;
    }
    state.turns.set(agentId, turn);
    state.rateLimitedThisTurn = false;
    state.noted.set(agentId, new Set());
    state.notes.set(agentId, []);
}
export function shouldCall(state) {
    return (state.halted === undefined
        && !state.rateLimitedThisTurn
        && state.transientFailures < JEV_TRANSIENT_FAILURE_LIMIT);
}
export function statusOf(state) {
    if (state.halted !== undefined) {
        return state.halted;
    }
    if (state.rateLimitedThisTurn) {
        return JEV_STATUS.rateLimited;
    }
    return state.transientFailures > 0
        ? JEV_STATUS.unavailable
        : JEV_STATUS.ready;
}
export function registerFailure(state, failure) {
    if (failure === 'cancelled') {
        return;
    }
    if (failure === 'rateLimited') {
        state.rateLimitedThisTurn = true;
        return;
    }
    if (failure === 'quota') {
        state.halted = JEV_STATUS.quota;
        return;
    }
    if (failure === 'auth') {
        state.halted = JEV_STATUS.auth;
        return;
    }
    state.transientFailures += 1;
    if (state.transientFailures >= JEV_TRANSIENT_FAILURE_LIMIT) {
        state.halted = JEV_STATUS.unavailable;
    }
}
export function registerSuccess(state) {
    state.halted = undefined;
    state.transientFailures = 0;
}
export function rememberNote(state, agentId, note) {
    const noted = state.noted.get(agentId) ?? new Set();
    state.noted.set(agentId, noted);
    const key = findingKey(note.path, note.ruleId);
    if (noted.has(key)) {
        return false;
    }
    noted.add(key);
    const notes = state.notes.get(agentId) ?? [];
    state.notes.set(agentId, notes);
    notes.push(note);
    return true;
}
export function takeNotes(state, agentId) {
    const notes = state.notes.get(agentId) ?? [];
    state.notes.set(agentId, []);
    return [...notes].sort((left, right) => right.probability - left.probability);
}
export function clearSession(state) {
    state.halted = undefined;
    state.transientFailures = 0;
    state.rateLimitedThisTurn = false;
    state.calls = 0;
    state.turns.clear();
    state.noted.clear();
    state.notes.clear();
}
