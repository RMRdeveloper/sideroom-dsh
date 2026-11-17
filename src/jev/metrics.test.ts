import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CALIBRATION_ACCEPTANCE_FLOOR,
  CALIBRATION_MIN_SAMPLES,
  createJevMetrics,
} from '@/jev/metrics.js';
import type { JevNote } from '@/jev/model.js';

function note(path: string, ruleId: string): JevNote {
  return { path, ruleId, probability: 0.9, model: undefined };
}

test('a delivered note counts as emitted', () => {
  const metrics = createJevMetrics();
  metrics.delivered([note('src/app.ts', 'fail-fast')], 1);
  metrics.delivered([note('src/app.ts', 'fail-fast')], 2);
  assert.deepEqual(metrics.snapshot().rules['fail-fast'], {
    emitted: 2,
    accepted: 0,
    rate: 0,
  });
});

test('a mutation in a later turn accepts the note', () => {
  const metrics = createJevMetrics();
  metrics.delivered([note('src/app.ts', 'fail-fast')], 1);
  metrics.mutation('src/app.ts', 2);
  assert.equal(metrics.snapshot().rules['fail-fast']?.accepted, 1);
});

test('a mutation in the same turn does not accept the note', () => {
  const metrics = createJevMetrics();
  metrics.delivered([note('src/app.ts', 'fail-fast')], 1);
  metrics.mutation('src/app.ts', 1);
  assert.equal(metrics.snapshot().rules['fail-fast']?.accepted, 0);
});

test('a mutation of another file accepts nothing', () => {
  const metrics = createJevMetrics();
  metrics.delivered([note('src/app.ts', 'fail-fast')], 1);
  metrics.mutation('src/other.ts', 2);
  assert.equal(metrics.snapshot().rules['fail-fast']?.accepted, 0);
});

test('settling keeps the previous turn and drops the older notes', () => {
  const metrics = createJevMetrics();
  metrics.delivered([note('src/app.ts', 'fail-fast')], 1);
  metrics.settle(2);
  metrics.mutation('src/app.ts', 2);
  assert.equal(metrics.snapshot().rules['fail-fast']?.accepted, 1);
  metrics.delivered([note('src/app.ts', 'fail-fast')], 1);
  metrics.settle(3);
  metrics.mutation('src/app.ts', 3);
  assert.equal(metrics.snapshot().rules['fail-fast']?.accepted, 1);
});

test('a rule below the floor is muted after enough samples', () => {
  const metrics = createJevMetrics();
  for (let turn = 0; turn < CALIBRATION_MIN_SAMPLES; turn += 1) {
    metrics.delivered([note('src/app.ts', 'fail-fast')], turn);
  }
  assert.deepEqual([...metrics.muted()], ['fail-fast']);
});

test('a rule at the floor is kept', () => {
  const metrics = createJevMetrics();
  const accepted = Math.round(
    CALIBRATION_MIN_SAMPLES * CALIBRATION_ACCEPTANCE_FLOOR,
  );
  for (let index = 0; index < CALIBRATION_MIN_SAMPLES; index += 1) {
    metrics.delivered([note('src/app.ts', 'fail-fast')], index);
    if (index < accepted) {
      metrics.mutation('src/app.ts', index + 1);
    }
  }
  assert.deepEqual([...metrics.muted()], []);
});

test('fewer samples than the minimum are never muted', () => {
  const metrics = createJevMetrics();
  for (let turn = 0; turn < CALIBRATION_MIN_SAMPLES - 1; turn += 1) {
    metrics.delivered([note('src/app.ts', 'fail-fast')], turn);
  }
  assert.deepEqual([...metrics.muted()], []);
});

test('the floor and the minimum are configurable', () => {
  const metrics = createJevMetrics();
  metrics.delivered([note('src/app.ts', 'fail-fast')], 1);
  assert.deepEqual([...metrics.muted(1, 0.5)], ['fail-fast']);
  assert.deepEqual([...metrics.muted(2, 0.5)], []);
});
