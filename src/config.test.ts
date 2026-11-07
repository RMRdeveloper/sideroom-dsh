import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, normalizeConfig } from '@/config.js';

test('an absent config resolves to the shipped defaults', () => {
  const { settings, warnings } = normalizeConfig(undefined);
  assert.deepEqual(settings, DEFAULTS);
  assert.deepEqual(warnings, []);
  assert.deepEqual(normalizeConfig(null).settings, DEFAULTS);
  assert.deepEqual(normalizeConfig({}).settings, DEFAULTS);
});

test('every default value is the expected one', () => {
  assert.deepEqual(DEFAULTS, {
    guidelines: { enabled: true, gateUnrecognized: false },
    rules: {
      enabled: true,
      blocking: ['braced-conditionals', 'explicit-any', 'swallowed-errors'],
      notes: [
        'clear-names',
        'stale-comments',
        'commented-code',
        'debug-artifacts',
        'suppressed-type-errors',
      ],
      degradeAfter: 3,
      resetAfter: 5,
    },
    review: { enabled: true },
    prompt: { contract: true, explain: true },
    checks: { enabled: true },
    skills: {
      enabled: true,
      packaged: true,
      monorepo: true,
      maxDepth: 3,
    },
  });
});

test('a partial config overrides only the keys it names', () => {
  const { settings } = normalizeConfig({
    rules: { blocking: ['clear-names'], degradeAfter: 7 },
  });
  assert.deepEqual(settings.rules.blocking, ['clear-names']);
  assert.equal(settings.rules.degradeAfter, 7);
  assert.equal(settings.rules.resetAfter, DEFAULTS.rules.resetAfter);
  assert.equal(settings.review.enabled, true);
});

test('every section can be replaced', () => {
  const { settings } = normalizeConfig({
    guidelines: { enabled: false, gateUnrecognized: true },
    rules: {
      enabled: false,
      blocking: ['clear-names'],
      notes: ['debug-artifacts'],
      degradeAfter: 0,
      resetAfter: 1,
    },
    review: { enabled: false },
    prompt: { contract: false, explain: false },
    checks: { enabled: false },
    skills: {
      enabled: false,
      packaged: false,
      monorepo: false,
      maxDepth: 0,
    },
  });
  assert.deepEqual(settings, {
    guidelines: { enabled: false, gateUnrecognized: true },
    rules: {
      enabled: false,
      blocking: ['clear-names'],
      notes: ['debug-artifacts'],
      degradeAfter: 0,
      resetAfter: 1,
    },
    review: { enabled: false },
    prompt: { contract: false, explain: false },
    checks: { enabled: false },
    skills: {
      enabled: false,
      packaged: false,
      monorepo: false,
      maxDepth: 0,
    },
  });
});

test('fallback rule lists are copies of the defaults', () => {
  const { settings } = normalizeConfig({});
  settings.rules.blocking.push('clear-names');
  assert.deepEqual(DEFAULTS.rules.blocking, [
    'braced-conditionals',
    'explicit-any',
    'swallowed-errors',
  ]);
});

test('an unknown rule id fails fast at load time', () => {
  assert.throws(
    () => normalizeConfig({ rules: { blocking: ['braced-conditional'] } }),
    /unknown rule ids/,
  );
  assert.throws(
    () => normalizeConfig({ rules: { notes: ['nope'] } }),
    /unknown rule ids: nope/,
  );
  assert.throws(
    () => normalizeConfig({ rules: { notes: [1] } }),
    /unknown rule ids: 1/,
  );
});

test('a rule list that is not an array fails fast', () => {
  assert.throws(
    () => normalizeConfig({ rules: { blocking: 'clear-names' } }),
    /must be a list of rule ids/,
  );
});

test('a section that is not an object fails fast', () => {
  for (const section of [
    'guidelines',
    'rules',
    'review',
    'prompt',
    'checks',
    'skills',
  ]) {
    assert.throws(
      () => normalizeConfig({ [section]: 'strict' }),
      new RegExp(`config\\.${section} must be an object`),
      section,
    );
    assert.throws(
      () => normalizeConfig({ [section]: [] }),
      new RegExp(`config\\.${section} must be an object`),
      section,
    );
  }
});

test('the bundle config itself must be an object', () => {
  assert.throws(
    () => normalizeConfig([]),
    /the bundle config must be an object/,
  );
  assert.throws(
    () => normalizeConfig('strict'),
    /the bundle config must be an object/,
  );
  assert.throws(
    () => normalizeConfig(1),
    /the bundle config must be an object/,
  );
});

test('a non-boolean flag fails fast', () => {
  assert.throws(
    () => normalizeConfig({ review: { enabled: 'yes' } }),
    /config\.review\.enabled must be a boolean/,
  );
  assert.throws(
    () => normalizeConfig({ skills: { monorepo: 1 } }),
    /config\.skills\.monorepo must be a boolean/,
  );
  assert.throws(
    () => normalizeConfig({ guidelines: { gateUnrecognized: null } }),
    /config\.guidelines\.gateUnrecognized must be a boolean/,
  );
});

test('a threshold that is not a non-negative integer fails fast', () => {
  for (const value of [1.5, -1, '3', Number.NaN]) {
    assert.throws(
      () => normalizeConfig({ rules: { degradeAfter: value } }),
      /non-negative integer/,
      String(value),
    );
  }
  assert.throws(
    () => normalizeConfig({ skills: { maxDepth: -1 } }),
    /non-negative integer/,
  );
});

test('zero is a valid threshold', () => {
  const { settings } = normalizeConfig({
    rules: { degradeAfter: 0, resetAfter: 0 },
    skills: { maxDepth: 0 },
  });
  assert.equal(settings.rules.degradeAfter, 0);
  assert.equal(settings.rules.resetAfter, 0);
  assert.equal(settings.skills.maxDepth, 0);
});

test('an unknown setting is reported instead of applied silently', () => {
  const { warnings } = normalizeConfig({
    review: { oncePerTurn: true },
    rules: { strict: true },
  });
  assert.ok(
    warnings.some((warning) => warning.includes('config.review.oncePerTurn')),
    JSON.stringify(warnings),
  );
  assert.ok(
    warnings.some((warning) => warning.includes('config.rules.strict')),
    JSON.stringify(warnings),
  );
});

test('an unknown section is reported', () => {
  const { warnings } = normalizeConfig({ unknown: true });
  assert.ok(
    warnings.some((warning) => warning.includes('config.unknown is not a known section')),
  );
});

test('a rule configured in both lists is reported', () => {
  const { warnings } = normalizeConfig({
    rules: { blocking: ['clear-names'], notes: ['clear-names'] },
  });
  assert.ok(
    warnings.some((warning) => warning.includes('both blocking and a note')),
    JSON.stringify(warnings),
  );
});

test('empty rule lists are accepted', () => {
  const { settings, warnings } = normalizeConfig({
    rules: { blocking: [], notes: [] },
  });
  assert.deepEqual(settings.rules.blocking, []);
  assert.deepEqual(settings.rules.notes, []);
  assert.deepEqual(warnings, []);
});
