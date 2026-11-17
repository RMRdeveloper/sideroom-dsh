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
    jev: {
      enabled: false,
      keyEnv: 'TYPESAFE_API_KEY',
      endpoint: 'https://api.typesafe.ai/v1/systemone',
      model: 'jev-latest',
      cutoff: 0.8,
      gate: 0.6,
      maxNotes: 3,
      timeoutMs: 3_000,
      maxRelatedFiles: 4,
      scanForConsumers: false,
      reviewPlans: true,
      reviewWorkflows: true,
      calibrate: false,
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
    jev: {
      enabled: false,
      keyEnv: 'JEV_KEY',
      endpoint: 'https://example.test/v1/systemone',
      model: 'jev-1.13.0',
      cutoff: 0.7,
      gate: 0.5,
      maxNotes: 1,
      timeoutMs: 1_000,
      maxRelatedFiles: 2,
      scanForConsumers: true,
      reviewPlans: false,
      reviewWorkflows: false,
      calibrate: true,
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
    jev: {
      enabled: false,
      keyEnv: 'JEV_KEY',
      endpoint: 'https://example.test/v1/systemone',
      model: 'jev-1.13.0',
      cutoff: 0.7,
      gate: 0.5,
      maxNotes: 1,
      timeoutMs: 1_000,
      maxRelatedFiles: 2,
      scanForConsumers: true,
      reviewPlans: false,
      reviewWorkflows: false,
      calibrate: true,
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

test('the Jev section stays off until it is enabled', () => {
  const { settings } = normalizeConfig({});
  assert.equal(settings.jev.enabled, false);
  const enabled = normalizeConfig({
    jev: {
      enabled: true,
      keyEnv: 'CUSTOM_JEV_KEY',
      endpoint: 'https://example.test/system',
      model: 'jev-1.13.0',
      cutoff: 0.9,
      gate: 0.5,
      maxNotes: 2,
      timeoutMs: 1_500,
      maxRelatedFiles: 6,
      scanForConsumers: true,
      reviewPlans: false,
      reviewWorkflows: false,
      calibrate: true,
    },
  }).settings.jev;
  assert.deepEqual(enabled, {
    enabled: true,
    keyEnv: 'CUSTOM_JEV_KEY',
    endpoint: 'https://example.test/system',
    model: 'jev-1.13.0',
    cutoff: 0.9,
    gate: 0.5,
    maxNotes: 2,
    timeoutMs: 1_500,
    maxRelatedFiles: 6,
    scanForConsumers: true,
    reviewPlans: false,
    reviewWorkflows: false,
    calibrate: true,
  });
});

test('a Jev text setting must be a non-empty string', () => {
  assert.throws(
    () => normalizeConfig({ jev: { model: '' } }),
    /config\.jev\.model must be a non-empty string/,
  );
  assert.throws(
    () => normalizeConfig({ jev: { endpoint: 42 } }),
    /config\.jev\.endpoint must be a non-empty string/,
  );
});

test('a Jev probability setting must sit between 0 and 1', () => {
  assert.throws(
    () => normalizeConfig({ jev: { cutoff: 1.5 } }),
    /config\.jev\.cutoff must be a number between 0 and 1/,
  );
  assert.throws(
    () => normalizeConfig({ jev: { gate: -0.1 } }),
    /config\.jev\.gate must be a number between 0 and 1/,
  );
  assert.throws(
    () => normalizeConfig({ jev: { cutoff: Number.NaN } }),
    /config\.jev\.cutoff must be a number between 0 and 1/,
  );
});

test('a Jev timeout must be a positive integer', () => {
  assert.throws(
    () => normalizeConfig({ jev: { timeoutMs: 0 } }),
    /config\.jev\.timeoutMs must be a positive integer/,
  );
  assert.throws(
    () => normalizeConfig({ jev: { timeoutMs: 1.5 } }),
    /config\.jev\.timeoutMs must be a positive integer/,
  );
});

test('an unknown Jev setting is reported', () => {
  const { warnings } = normalizeConfig({ jev: { key: 'x' } });
  assert.ok(
    warnings.some((warning) => warning.includes('config.jev.key')),
    JSON.stringify(warnings),
  );
});

test('a counter must be a non-negative integer', () => {
  assert.throws(
    () => normalizeConfig({ rules: { degradeAfter: -1 } }),
    /must be a non-negative integer/,
  );
  assert.throws(
    () => normalizeConfig({ jev: { maxNotes: -1 } }),
    /must be a non-negative integer/,
  );
});

test('a ratio accepts both endpoints', () => {
  assert.equal(normalizeConfig({ jev: { cutoff: 0 } }).settings.jev.cutoff, 0);
  assert.equal(normalizeConfig({ jev: { gate: 1 } }).settings.jev.gate, 1);
});

test('the timeout accepts the smallest positive integer', () => {
  assert.equal(
    normalizeConfig({ jev: { timeoutMs: 1 } }).settings.jev.timeoutMs,
    1,
  );
});

test('a fractional counter is rejected', () => {
  assert.throws(
    () => normalizeConfig({ rules: { degradeAfter: 1.5 } }),
    /must be a non-negative integer/,
  );
});

test('a zero counter is accepted', () => {
  assert.equal(
    normalizeConfig({ rules: { resetAfter: 0 } }).settings.rules.resetAfter,
    0,
  );
});

test('a fractional ratio between the endpoints is accepted', () => {
  assert.equal(
    normalizeConfig({ jev: { cutoff: 0.35 } }).settings.jev.cutoff,
    0.35,
  );
});

test('a text setting is trimmed', () => {
  assert.equal(
    normalizeConfig({ jev: { endpoint: '  https://example.test  ' } })
      .settings.jev.endpoint,
    'https://example.test',
  );
});
