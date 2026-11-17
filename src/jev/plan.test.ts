import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPlanRequestBody,
  filePathsIn,
  formatPlanNotes,
} from '@/jev/plan.js';
import type { JevPlanState } from '@/jev/model.js';

const PLAN = `# Plan

1. Update \`src/app.ts\` and \`src/util.ts\`.
2. Update \`src/app.ts\` again, ignoring \`README.md\`.

Then run the checks.`;

test('mentioned source paths are extracted once', () => {
  assert.deepEqual(filePathsIn(PLAN), ['src/app.ts', 'src/util.ts']);
});

test('the mentioned paths are capped', () => {
  const plan = Array.from(
    { length: 6 },
    (_, index) => `touch \`src/file${String(index)}.ts\``,
  ).join('\n');
  assert.equal(filePathsIn(plan).length, 4);
});

test('a plan without evidence asks only the local rules', () => {
  const request = buildPlanRequestBody({
    plan: PLAN,
    files: [],
    model: 'jev-latest',
  });
  assert.ok('would-reject' in request.questions);
  assert.ok('plan-bundled-decisions' in request.questions);
  assert.ok('plan-verification' in request.questions);
  assert.equal('plan-duplicates-existing' in request.questions, false);
  assert.equal('plan-abstraction-justified' in request.questions, false);
  assert.equal('plan-contradicts-evidence' in request.questions, false);
});

test('a plan with evidence asks the evidence rules', () => {
  const request = buildPlanRequestBody({
    plan: PLAN,
    files: [{ path: 'src/app.ts', body: 'export const total = 1;' }],
    model: 'jev-latest',
  });
  assert.ok('plan-duplicates-existing' in request.questions);
  assert.ok('plan-abstraction-justified' in request.questions);
  assert.ok('plan-contradicts-evidence' in request.questions);
});

test('the plan state carries the text, the mentions and the files', () => {
  const request = buildPlanRequestBody({
    plan: PLAN,
    files: [{ path: 'src/app.ts', body: 'export const total = 1;' }],
    model: 'jev-latest',
  });
  const state = request.state as JevPlanState;
  assert.equal(state.plan.text, PLAN);
  assert.deepEqual(state.plan.mentionedFiles, ['src/app.ts', 'src/util.ts']);
  assert.deepEqual(state.files, [
    { path: 'src/app.ts', body: 'export const total = 1;' },
  ]);
});

test('the plan notes name the model and the rules', () => {
  const text = formatPlanNotes([
    { path: 'plan', ruleId: 'plan-verification', probability: 0.9, model: 'jev-1.14.0' },
  ]);
  assert.match(text, /^Sideroom Jev plan review \(model jev-1\.14\.0/);
  assert.match(text, /\[plan-verification\] p=0\.90/);
  assert.match(text, /Verify each point against the code/);
});

test('the plan notes omit an unknown model', () => {
  const text = formatPlanNotes([
    { path: 'plan', ruleId: 'plan-verification', probability: 0.9, model: undefined },
  ]);
  assert.match(text, /^Sideroom Jev plan review \(advisory, never a gate\):/);
});
