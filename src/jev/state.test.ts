import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JevNote } from '@/jev/model.js';
import {
  beginTurn,
  clearSession,
  createJevState,
  JEV_STATUS,
  JEV_TRANSIENT_FAILURE_LIMIT,
  registerFailure,
  registerSuccess,
  rememberNote,
  shouldCall,
  statusOf,
  takeNotes,
} from '@/jev/state.js';

const AGENT = 'agent-1';

function note(path: string, ruleId: string, probability: number): JevNote {
  return { path, ruleId, probability, model: 'jev-1.14.0' };
}

test('a fresh state is ready and callable', () => {
  const state = createJevState();
  assert.equal(statusOf(state), JEV_STATUS.ready);
  assert.equal(shouldCall(state), true);
  assert.equal(state.calls, 0);
});

test('a rate limit pauses calls until the next turn', () => {
  const state = createJevState();
  beginTurn(state, AGENT, 1);
  registerFailure(state, 'rateLimited');
  assert.equal(statusOf(state), JEV_STATUS.rateLimited);
  assert.equal(shouldCall(state), false);
  beginTurn(state, AGENT, 2);
  assert.equal(shouldCall(state), true);
  assert.equal(statusOf(state), JEV_STATUS.ready);
});

test('quota and auth halt the guard until a success', () => {
  const state = createJevState();
  registerFailure(state, 'quota');
  assert.equal(statusOf(state), JEV_STATUS.quota);
  assert.equal(shouldCall(state), false);
  registerSuccess(state);
  assert.equal(shouldCall(state), true);
  registerFailure(state, 'auth');
  assert.equal(statusOf(state), JEV_STATUS.auth);
});

test('three consecutive transient failures halt the guard', () => {
  const state = createJevState();
  for (let index = 0; index < JEV_TRANSIENT_FAILURE_LIMIT - 1; index += 1) {
    registerFailure(state, 'transient');
  }
  assert.equal(shouldCall(state), true);
  assert.equal(statusOf(state), JEV_STATUS.unavailable);
  registerFailure(state, 'transient');
  assert.equal(shouldCall(state), false);
  registerSuccess(state);
  assert.equal(shouldCall(state), true);
});

test('a cancelled request changes nothing', () => {
  const state = createJevState();
  registerFailure(state, 'cancelled');
  assert.equal(state.transientFailures, 0);
  assert.equal(state.halted, undefined);
  assert.equal(statusOf(state), JEV_STATUS.ready);
});

test('a note is remembered once per turn', () => {
  const state = createJevState();
  beginTurn(state, AGENT, 1);
  assert.equal(
    rememberNote(state, AGENT, note('src/app.ts', 'fail-fast', 0.9)),
    true,
  );
  assert.equal(
    rememberNote(state, AGENT, note('src/app.ts', 'fail-fast', 0.95)),
    false,
  );
  assert.equal(
    rememberNote(state, AGENT, note('src/app.ts', 'test-quality', 0.9)),
    true,
  );
  beginTurn(state, AGENT, 2);
  assert.equal(
    rememberNote(state, AGENT, note('src/app.ts', 'fail-fast', 0.9)),
    true,
  );
});

test('notes come back strongest first and are consumed', () => {
  const state = createJevState();
  beginTurn(state, AGENT, 1);
  rememberNote(state, AGENT, note('src/app.ts', 'fail-fast', 0.81));
  rememberNote(state, AGENT, note('src/app.ts', 'test-quality', 0.95));
  const notes = takeNotes(state, AGENT);
  assert.deepEqual(
    notes.map((entry) => entry.ruleId),
    ['test-quality', 'fail-fast'],
  );
  assert.deepEqual(takeNotes(state, AGENT), []);
});

test('a new turn clears the notes of the previous one', () => {
  const state = createJevState();
  beginTurn(state, AGENT, 1);
  rememberNote(state, AGENT, note('src/app.ts', 'fail-fast', 0.9));
  beginTurn(state, AGENT, 2);
  assert.deepEqual(takeNotes(state, AGENT), []);
});

test('the session reset clears the counters and the notes', () => {
  const state = createJevState();
  beginTurn(state, AGENT, 1);
  rememberNote(state, AGENT, note('src/app.ts', 'fail-fast', 0.9));
  state.calls = 7;
  state.lastModel = 'jev-1.14.0';
  clearSession(state);
  assert.equal(state.calls, 0);
  assert.equal(state.lastModel, 'jev-1.14.0');
  assert.equal(state.turns.size, 0);
  assert.deepEqual(takeNotes(state, AGENT), []);
});

test('the status literals are stable', () => {
  assert.equal(statusOf(createJevState()), 'ready');
  const quota = createJevState();
  registerFailure(quota, 'quota');
  assert.equal(statusOf(quota), 'quota');
  const auth = createJevState();
  registerFailure(auth, 'auth');
  assert.equal(statusOf(auth), 'auth');
  const limited = createJevState();
  registerFailure(limited, 'rateLimited');
  assert.equal(statusOf(limited), 'rateLimited');
  const transient = createJevState();
  registerFailure(transient, 'transient');
  assert.equal(statusOf(transient), 'unavailable');
});
