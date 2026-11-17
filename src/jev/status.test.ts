import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildJevReport,
  formatJevReport,
  JEV_OFF_STATUS,
  NO_KEY_SOURCE,
  type JevReportInput,
} from '@/jev/status.js';
import { JEV_STATUS } from '@/jev/state.js';

function reportInput(overrides: Partial<JevReportInput> = {}): JevReportInput {
  return {
    enabled: true,
    keyEnv: 'TYPESAFE_API_KEY',
    key: { key: 'sk-secret', origin: 'environment' },
    model: 'jev-latest',
    cutoff: 0.8,
    gate: 0.6,
    runtime: JEV_STATUS.ready,
    calls: 3,
    muted: [],
    ...overrides,
  };
}

test('a disabled integration reports off even with a key', () => {
  const report = buildJevReport(reportInput({ enabled: false }));
  assert.equal(report.status, JEV_OFF_STATUS);
  assert.equal(report.keySource, 'environment');
});

test('an enabled integration without a key reports noKey', () => {
  const report = buildJevReport(reportInput({ key: undefined }));
  assert.equal(report.status, JEV_STATUS.noKey);
  assert.equal(report.keySource, NO_KEY_SOURCE);
});

test('a key source reports its origin', () => {
  assert.equal(
    buildJevReport(reportInput()).keySource,
    'environment',
  );
  assert.equal(
    buildJevReport(
      reportInput({ key: { key: 'sk-stored', origin: 'credentials' } }),
    ).keySource,
    'credentials',
  );
});

test('muted rules are sorted', () => {
  const report = buildJevReport(
    reportInput({ muted: ['test-quality', 'comments'] }),
  );
  assert.deepEqual(report.muted, ['comments', 'test-quality']);
});

test('the report is a line-oriented status block', () => {
  const text = formatJevReport(buildJevReport(reportInput()));
  assert.equal(
    text,
    [
      'Jev review',
      'enabled: true',
      'keyEnv: TYPESAFE_API_KEY',
      'key: environment',
      'model: jev-latest',
      'status: ready',
      'calls: 3',
      'cutoff: 0.8',
      'gate: 0.6',
      'muted: none',
    ].join('\n'),
  );
});

test('muted rules are listed in the report', () => {
  const text = formatJevReport(
    buildJevReport(reportInput({ muted: ['comments', 'test-quality'] })),
  );
  assert.match(text, /^muted: comments, test-quality$/mu);
});

test('a disabled report hints at the configuration key', () => {
  const text = formatJevReport(buildJevReport(reportInput({ enabled: false })));
  assert.match(text, /^hint: set jev\.enabled to true/mu);
});

test('a keyless report hints at the credential reference', () => {
  const text = formatJevReport(buildJevReport(reportInput({ key: undefined })));
  assert.match(text, /^hint: store a key for TYPESAFE_API_KEY/mu);
});

test('a ready report carries no hint', () => {
  const text = formatJevReport(buildJevReport(reportInput()));
  assert.equal(text.includes('hint:'), false);
});
