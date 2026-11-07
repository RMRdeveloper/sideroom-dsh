import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRunStore } from '@/state/store.js';

test('a new turn clears loaded guides and the armed review', () => {
  const store = createRunStore();
  store.beginTurn('agent-1', 1);
  store.markLoaded('agent-1', 'contract');
  store.armReview('agent-1', '/project');
  assert.equal(store.isLoaded('agent-1', 'contract'), true);
  assert.deepEqual(store.pendingReview('agent-1'), { cwd: '/project' });

  store.beginTurn('agent-1', 2);
  assert.equal(store.isLoaded('agent-1', 'contract'), false);
  assert.equal(store.pendingReview('agent-1'), null);
});

test('the same turn keeps its loaded guides and review', () => {
  const store = createRunStore();
  store.beginTurn('agent-1', 1);
  store.markLoaded('agent-1', 'typescript');
  store.armReview('agent-1', '/project');
  store.beginTurn('agent-1', 1);
  assert.equal(store.isLoaded('agent-1', 'typescript'), true);
  assert.deepEqual(store.pendingReview('agent-1'), { cwd: '/project' });
});

test('a sent review is not offered again in the same turn', () => {
  const store = createRunStore();
  store.beginTurn('agent-1', 1);
  store.armReview('agent-1', '/project');
  store.markReviewSent('agent-1');
  assert.equal(store.pendingReview('agent-1'), null);

  store.armReview('agent-1', '/project');
  assert.equal(store.pendingReview('agent-1'), null);
});

test('a review armed in one turn does not leak into the next', () => {
  const store = createRunStore();
  store.beginTurn('agent-1', 1);
  store.armReview('agent-1', '/project');
  store.beginTurn('agent-1', 2);
  assert.equal(store.pendingReview('agent-1'), null);
});

test('an unknown agent has nothing loaded or armed', () => {
  const store = createRunStore();
  assert.equal(store.isLoaded('missing', 'contract'), false);
  assert.equal(store.pendingReview('missing'), null);
});

test('different agents keep separate state', () => {
  const store = createRunStore();
  store.beginTurn('first', 1);
  store.beginTurn('second', 1);
  store.markLoaded('first', 'contract');
  store.armReview('first', '/first');
  assert.equal(store.isLoaded('second', 'contract'), false);
  assert.equal(store.pendingReview('second'), null);
  assert.deepEqual(store.pendingReview('first'), { cwd: '/first' });
});

test('breakers are per agent and per rule and reset with the turn', () => {
  const store = createRunStore();
  store.beginTurn('agent-1', 1);
  const counter = store.breaker('agent-1', 'braced-conditionals');
  assert.deepEqual(counter, { blocks: 0, clean: 0 });
  counter.blocks = 2;
  assert.equal(
    store.breaker('agent-1', 'braced-conditionals').blocks,
    2,
  );
  assert.deepEqual(store.breaker('agent-1', 'clear-names'), {
    blocks: 0,
    clean: 0,
  });
  assert.deepEqual(store.breaker('agent-2', 'braced-conditionals'), {
    blocks: 0,
    clean: 0,
  });

  store.beginTurn('agent-1', 2);
  assert.deepEqual(store.breaker('agent-1', 'braced-conditionals'), {
    blocks: 0,
    clean: 0,
  });
});

test('marking a review sent clears the stored cwd', () => {
  const store = createRunStore();
  store.beginTurn('agent-1', 1);
  store.armReview('agent-1', '/project');
  store.markReviewSent('agent-1');
  assert.equal(store.pendingReview('agent-1'), null);
  store.beginTurn('agent-1', 2);
  store.armReview('agent-1', '/other');
  assert.deepEqual(store.pendingReview('agent-1'), { cwd: '/other' });
});
