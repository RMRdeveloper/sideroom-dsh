import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewMessage, reviewText } from '@/review.js';

const BASE = `Sideroom review — before calling this done:

1. Re-read every file you changed in this run against the guidelines you loaded. Structural rules
   3, 4, 7, 8, 9, 10 and 20 and architectural rules 11-18 need judgment, not a linter.
2. Run the project formatter, linter, type checks, and tests that apply to the files you touched.
3. Report the exact commands and their outcome. If a check fails, fix it before you finish.`;

test('the review names the detected command when it is known', () => {
  assert.equal(
    reviewText({ command: 'pnpm check', green: false }),
    `${BASE}

Detected check command: \`pnpm check\`.`,
  );
});

test('the review reuses a green result instead of asking again', () => {
  assert.equal(
    reviewText({ command: 'pnpm check', green: true }),
    `${BASE}

Checks already green this run: \`pnpm check\`. Reuse that result instead of running it again; rerun only what this edit could have affected.`,
  );
});

test('the review omits the command when detection found none', () => {
  assert.equal(reviewText({ command: null, green: false }), BASE);
  assert.equal(reviewText({ command: null, green: true }), BASE);
});

test('the review message is a steering user message with its own source', () => {
  const message = reviewMessage('Sideroom review');
  assert.equal(message.role, 'user');
  assert.deepEqual(message.content, [
    { type: 'text', text: 'Sideroom review' },
  ]);
  assert.equal((message.source as { kind: string }).kind, 'sideroom-review');
  assert.notEqual(message.id, '');
  assert.equal(Object.isFrozen(message), true);
  assert.equal(Object.isFrozen(message.content), true);
});
