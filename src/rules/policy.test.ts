import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RuleCounter as Counter } from '@/state/store.js';
import { collectFindings } from '@/rules/index.js';
import { evaluate } from '@/rules/policy.js';
import type { Finding, RulePolicy } from '@/rules/types.js';

function breakerFrom(
  counters: Map<string, Counter>,
): (agentId: string, rule: string) => Counter {
  return (agentId, rule) => {
    const key = `${agentId}/${rule}`;
    let counter = counters.get(key);
    if (counter === undefined) {
      counter = { blocks: 0, clean: 0 };
      counters.set(key, counter);
    }
    return counter;
  };
}

const POLICY: RulePolicy = {
  blocking: ['braced-conditionals'],
  notes: [],
  degradeAfter: 3,
  resetAfter: 5,
};

function violation(): Finding[] {
  return collectFindings({
    lines: ['if (!user) return 0;'],
    language: 'javascript',
  });
}

test('the breaker degrades the fourth violation to a note', () => {
  const counters = new Map<string, Counter>();
  const breaker = breakerFrom(counters);
  const outcomes = [1, 2, 3, 4].map(() =>
    evaluate({ findings: violation(), config: POLICY, breaker, agentId: 'a' }),
  );
  assert.deepEqual(
    outcomes.map((outcome) => outcome.blocks.length),
    [1, 1, 1, 0],
  );
  assert.equal(outcomes[3].notes[0].degraded, true);
});

test('the breaker resets after five clean checks', () => {
  const counters = new Map<string, Counter>();
  const breaker = breakerFrom(counters);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    evaluate({ findings: violation(), config: POLICY, breaker, agentId: 'a' });
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const outcome = evaluate({
      findings: [],
      config: POLICY,
      breaker,
      agentId: 'a',
    });
    assert.equal(outcome.blocks.length, 0);
  }
  const again = evaluate({
    findings: violation(),
    config: POLICY,
    breaker,
    agentId: 'a',
  });
  assert.equal(again.blocks.length, 1);
});

const MIXED: RulePolicy = {
  blocking: ['braced-conditionals'],
  notes: ['clear-names'],
  degradeAfter: 3,
  resetAfter: 5,
};

function clearName(): Finding[] {
  return collectFindings({
    lines: ['const data = 1;'],
    language: 'javascript',
  });
}

function debugLine(): Finding[] {
  return collectFindings({
    lines: ['console.log(value)'],
    language: 'javascript',
  });
}

test('a configured note is returned as a note', () => {
  const counters = new Map<string, Counter>();
  const outcome = evaluate({
    findings: clearName(),
    config: MIXED,
    breaker: breakerFrom(counters),
    agentId: 'a',
  });
  assert.equal(outcome.blocks.length, 0);
  assert.equal(outcome.notes.length, 1);
  assert.equal(outcome.notes[0].rule, 'clear-names');
});

test('a rule in neither list is ignored', () => {
  const counters = new Map<string, Counter>();
  const outcome = evaluate({
    findings: debugLine(),
    config: MIXED,
    breaker: breakerFrom(counters),
    agentId: 'a',
  });
  assert.deepEqual(outcome, { blocks: [], notes: [] });
});

test('a block and a note are classified separately', () => {
  const counters = new Map<string, Counter>();
  const outcome = evaluate({
    findings: [...violation(), ...clearName()],
    config: MIXED,
    breaker: breakerFrom(counters),
    agentId: 'a',
  });
  assert.equal(outcome.blocks.length, 1);
  assert.equal(outcome.notes.length, 1);
});

test('degradeAfter zero turns the first block into a note', () => {
  const counters = new Map<string, Counter>();
  const outcome = evaluate({
    findings: violation(),
    config: { ...MIXED, degradeAfter: 0 },
    breaker: breakerFrom(counters),
    agentId: 'a',
  });
  assert.equal(outcome.blocks.length, 0);
  assert.equal(outcome.notes.length, 1);
  assert.equal(outcome.notes[0].degraded, true);
});

test('a clean check resets the block counter after resetAfter', () => {
  const counters = new Map<string, Counter>();
  const breaker = breakerFrom(counters);
  const config = { ...MIXED, resetAfter: 1 };
  evaluate({ findings: violation(), config, breaker, agentId: 'a' });
  evaluate({ findings: [], config, breaker, agentId: 'a' });
  const again = evaluate({
    findings: violation(),
    config,
    breaker,
    agentId: 'a',
  });
  assert.equal(again.blocks.length, 1);
});

test('multiple blocking findings share the rule counter', () => {
  const counters = new Map<string, Counter>();
  const breaker = breakerFrom(counters);
  const config = { ...MIXED, degradeAfter: 1 };
  const outcome = evaluate({
    findings: [...violation(), ...violation()],
    config,
    breaker,
    agentId: 'a',
  });
  assert.equal(outcome.blocks.length, 1);
  assert.equal(outcome.notes.length, 1);
  assert.equal(outcome.notes[0].degraded, true);
});
