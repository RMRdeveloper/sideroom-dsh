import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES, RULE_IDS } from '@/rules/types.js';

test('the rule catalog exposes every rule id', () => {
  assert.deepEqual(RULE_IDS, Object.keys(RULES));
  assert.equal(RULE_IDS.length, 8);
});

test('every rule has a name, a fix and a valid number', () => {
  for (const rule of RULE_IDS) {
    const meta = RULES[rule];
    assert.notEqual(meta.name, '');
    assert.notEqual(meta.fix, '');
    assert.ok(meta.number === null || typeof meta.number === 'number');
  }
});

test('the canonical rule numbers are the expected ones', () => {
  assert.equal(RULES['braced-conditionals'].number, 1);
  assert.equal(RULES['swallowed-errors'].number, 5);
  assert.equal(RULES['clear-names'].number, 6);
  assert.equal(RULES['stale-comments'].number, 19);
  assert.equal(RULES['commented-code'].number, 19);
  assert.equal(RULES['debug-artifacts'].number, 19);
  assert.equal(RULES['suppressed-type-errors'].number, 19);
  assert.equal(RULES['explicit-any'].number, null);
});

test('the rule metadata names are stable', () => {
  assert.equal(RULES['braced-conditionals'].name, 'Braced conditionals');
  assert.equal(RULES['explicit-any'].name, 'Explicit any');
  assert.equal(RULES['swallowed-errors'].name, 'Explicit error handling');
  assert.equal(RULES['clear-names'].name, 'Clear names');
  assert.equal(RULES['stale-comments'].name, 'Comments');
  assert.equal(RULES['commented-code'].name, 'Comments');
  assert.equal(RULES['debug-artifacts'].name, 'Debug artifacts');
  assert.equal(RULES['suppressed-type-errors'].name, 'Suppressed type errors');
});
