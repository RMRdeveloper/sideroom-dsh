import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildFileState,
  buildRequestBody,
  findingKey,
  formatFindingNote,
  formatJevNotes,
  isReviewablePath,
  isTestPath,
  JEV_GATE_QUESTION,
  JEV_RULES,
  parseEnvelope,
  readFindings,
  readGate,
  requestFitsBudget,
  type JevRelatedFile,
} from '@/jev/model.js';

const GATE_PASSING = 0.95;

function envelope(
  answers: Record<string, { noul: number }>,
  model: string | undefined = 'jev-1.14.0',
): string {
  return JSON.stringify({ model, answers });
}

function stateWith({
  path = 'src/app.ts',
  body = 'export const total = 1;\n',
  kind = 'write',
  addedLines = ['export const total = 1;'],
  relatedFiles = [],
}: {
  path?: string;
  body?: string;
  kind?: string;
  addedLines?: string[];
  relatedFiles?: JevRelatedFile[];
} = {}): ReturnType<typeof buildFileState> {
  return buildFileState({ path, body, kind, addedLines, relatedFiles });
}

test('the rule set covers the fourteen guide judgments', () => {
  assert.equal(JEV_RULES.length, 14);
  assert.equal(new Set(JEV_RULES.map((rule) => rule.id)).size, 14);
  assert.equal(JEV_GATE_QUESTION.id, 'would-reject');
});

test('only source languages are reviewable', () => {
  assert.equal(isReviewablePath('src/app.ts'), true);
  assert.equal(isReviewablePath('README.md'), false);
  assert.equal(isReviewablePath('package.json'), false);
  assert.equal(isReviewablePath('Makefile'), false);
});

test('the file state carries the language and the added lines', () => {
  const state = stateWith({ addedLines: ['const a = 1;', 'const b = 2;'] });
  assert.equal(state.file.language, 'typescript');
  assert.deepEqual(state.change.addedLines, ['const a = 1;', 'const b = 2;']);
  assert.deepEqual(state.context, { files: [], partial: false });
});

test('the request always asks the global gate question', () => {
  const request = buildRequestBody(stateWith(), 'jev-latest');
  assert.equal(request.model, 'jev-latest');
  assert.ok('would-reject' in request.questions);
  assert.ok('guard-clauses' in request.questions);
  assert.ok('single-responsibility' in request.questions);
});

test('dependency direction needs an imported file', () => {
  const without = buildRequestBody(stateWith(), 'jev-latest');
  assert.equal('dependency-direction' in without.questions, false);
  const withImport = buildRequestBody(
    stateWith({
      relatedFiles: [
        { path: 'src/db.ts', body: 'export const db = 1;', relation: 'imported' },
      ],
    }),
    'jev-latest',
  );
  assert.ok('dependency-direction' in withImport.questions);
});

test('the comments question needs a comment marker in the added lines', () => {
  const without = buildRequestBody(stateWith(), 'jev-latest');
  assert.equal('comments' in without.questions, false);
  const withComment = buildRequestBody(
    stateWith({ addedLines: ['// explain the trade-off'] }),
    'jev-latest',
  );
  assert.ok('comments' in withComment.questions);
});

test('contract compatibility needs a supplied consumer', () => {
  const without = buildRequestBody(stateWith(), 'jev-latest');
  assert.equal('contract-compatibility' in without.questions, false);
  const withConsumer = buildRequestBody(
    stateWith({
      relatedFiles: [
        { path: 'src/consumer.ts', body: 'total();', relation: 'consumer' },
      ],
    }),
    'jev-latest',
  );
  assert.ok('contract-compatibility' in withConsumer.questions);
});

test('test quality needs both a test and production body', () => {
  const without = buildRequestBody(stateWith(), 'jev-latest');
  assert.equal('test-quality' in without.questions, false);
  const withTest = buildRequestBody(
    stateWith({
      relatedFiles: [
        { path: 'src/app.test.ts', body: 'test()', relation: 'test' },
      ],
    }),
    'jev-latest',
  );
  assert.ok('test-quality' in withTest.questions);
});

test('a state that exceeds the byte budget is refused', () => {
  const huge = stateWith({ body: 'x'.repeat(70_000) });
  assert.equal(requestFitsBudget(buildRequestBody(huge, 'jev-latest')), false);
  assert.equal(
    requestFitsBudget(buildRequestBody(stateWith(), 'jev-latest')),
    true,
  );
});

test('a malformed response envelope is rejected', () => {
  assert.equal(parseEnvelope('not json'), undefined);
  assert.equal(parseEnvelope('[]'), undefined);
  assert.equal(parseEnvelope('"text"'), undefined);
  const parsed = parseEnvelope('{"model":"jev-1.14.0","answers":{}}');
  assert.deepEqual(parsed, { model: 'jev-1.14.0', answers: {} });
});

test('answers are read only when they carry a noul number', () => {
  const parsed = parseEnvelope(
    '{"answers":{"fail-fast":{"noul":0.9},"broken":{"noul":"high"},"empty":null}}',
  );
  assert.deepEqual(parsed?.answers, { 'fail-fast': { noul: 0.9 } });
});

test('the gate is read when it is a probability', () => {
  const parsed = parseEnvelope(envelope({ 'would-reject': { noul: 0.7 } }));
  assert.equal(parsed === undefined ? undefined : readGate(parsed), 0.7);
  const missing = parseEnvelope(envelope({ 'fail-fast': { noul: 0.9 } }));
  assert.equal(missing === undefined ? undefined : readGate(missing), undefined);
});

test('findings respect the cutoff and the gate', () => {
  const parsed = parseEnvelope(
    envelope({
      'would-reject': { noul: GATE_PASSING },
      'single-responsibility': { noul: 0.91 },
      'fail-fast': { noul: 0.2 },
      'test-quality': { noul: 0.8 },
    }),
  );
  assert.notEqual(parsed, undefined);
  const findings = readFindings({
    envelope: parsed ?? { model: undefined, answers: undefined },
    asked: new Set(['single-responsibility', 'fail-fast', 'test-quality']),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.deepEqual(findings, [
    { ruleId: 'single-responsibility', probability: 0.91 },
    { ruleId: 'test-quality', probability: 0.8 },
  ]);
});

test('a low gate answer suppresses every finding', () => {
  const parsed = parseEnvelope(
    envelope({
      'would-reject': { noul: 0.3 },
      'single-responsibility': { noul: 0.99 },
    }),
  );
  const findings = readFindings({
    envelope: parsed ?? { model: undefined, answers: undefined },
    asked: new Set(['single-responsibility']),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.deepEqual(findings, []);
});

test('a missing gate answer suppresses every finding', () => {
  const parsed = parseEnvelope(
    envelope({ 'single-responsibility': { noul: 0.99 } }),
  );
  const findings = readFindings({
    envelope: parsed ?? { model: undefined, answers: undefined },
    asked: new Set(['single-responsibility']),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.deepEqual(findings, []);
});

test('an unasked rule is never reported', () => {
  const parsed = parseEnvelope(
    envelope({
      'would-reject': { noul: GATE_PASSING },
      'test-quality': { noul: 0.99 },
    }),
  );
  const findings = readFindings({
    envelope: parsed ?? { model: undefined, answers: undefined },
    asked: new Set(['single-responsibility']),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.deepEqual(findings, []);
});

test('a finding note keeps the path, rule and model', () => {
  const note = formatFindingNote({
    path: 'src/app.ts',
    finding: { ruleId: 'fail-fast', probability: 0.93 },
    model: 'jev-1.14.0',
  });
  assert.deepEqual(note, {
    path: 'src/app.ts',
    ruleId: 'fail-fast',
    probability: 0.93,
    model: 'jev-1.14.0',
  });
});

test('the notes block names the model and every finding', () => {
  const text = formatJevNotes([
    {
      path: 'src/app.ts',
      ruleId: 'single-responsibility',
      probability: 0.91,
      model: 'jev-1.14.0',
    },
    {
      path: 'src/db.ts',
      ruleId: 'fail-fast',
      probability: 0.85,
      model: undefined,
    },
  ]);
  assert.match(text, /^Sideroom Jev review \(model jev-1\.14\.0, advisory, never a gate\):/);
  assert.match(text, /`src\/app\.ts` \[single-responsibility\] p=0\.91/);
  assert.match(text, /`src\/db\.ts` \[fail-fast\] p=0\.85/);
  assert.match(text, /Missing context is not proof of a problem/);
});

test('the notes block omits the model when it is unknown', () => {
  const text = formatJevNotes([
    { path: 'src/app.ts', ruleId: 'fail-fast', probability: 0.9, model: undefined },
  ]);
  assert.match(text, /^Sideroom Jev review \(advisory, never a gate\):/);
});

test('the finding key combines the path and the rule', () => {
  assert.equal(findingKey('src/app.ts', 'fail-fast'), 'src/app.ts#fail-fast');
});

test('test paths follow every supported convention', () => {
  assert.equal(isTestPath('src/app.test.ts'), true);
  assert.equal(isTestPath('src/app.spec.ts'), true);
  assert.equal(isTestPath('src/app_test.py'), true);
  assert.equal(isTestPath('src/test_app.py'), true);
  assert.equal(isTestPath('src/__tests__/app.ts'), true);
  assert.equal(isTestPath('src/tests/app.ts'), true);
  assert.equal(isTestPath('src/AppTest.java'), true);
  assert.equal(isTestPath('src/latest.ts'), false);
  assert.equal(isTestPath('src/contest.ts'), false);
});

test('test quality runs for a changed test with supplied production', () => {
  const request = buildRequestBody(
    stateWith({
      path: 'src/app.test.ts',
      relatedFiles: [
        { path: 'src/app.ts', body: 'export const total = 1;', relation: 'consumer' },
      ],
    }),
    'jev-latest',
  );
  assert.ok('test-quality' in request.questions);
});

test('a consumer that is only a test does not enable contract compatibility', () => {
  const request = buildRequestBody(
    stateWith({
      relatedFiles: [
        { path: 'src/app.test.ts', body: 'total();', relation: 'consumer' },
      ],
    }),
    'jev-latest',
  );
  assert.equal('contract-compatibility' in request.questions, false);
});

test('a hash comment enables the comments question', () => {
  const request = buildRequestBody(
    stateWith({ addedLines: ['# explain the hazard'] }),
    'jev-latest',
  );
  assert.ok('comments' in request.questions);
});

test('findings with equal probability fall back to the rule id order', () => {
  const parsed = parseEnvelope(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.9 },
      'guard-clauses': { noul: 0.9 },
    }),
  );
  const findings = readFindings({
    envelope: parsed ?? { model: undefined, answers: undefined },
    asked: new Set(['fail-fast', 'guard-clauses']),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    ['fail-fast', 'guard-clauses'],
  );
});

test('an out-of-range gate probability is ignored', () => {
  const parsed = parseEnvelope(
    envelope({ 'would-reject': { noul: 1.5 }, 'fail-fast': { noul: 0.9 } }),
  );
  assert.equal(parsed === undefined ? undefined : readGate(parsed), undefined);
});

test('a non-object answers payload yields no findings', () => {
  const parsed = parseEnvelope('{"answers":"none"}');
  assert.deepEqual(parsed?.answers, undefined);
});

test('an empty notes list keeps the advisory footer', () => {
  const text = formatJevNotes([]);
  assert.match(text, /^Sideroom Jev review \(advisory, never a gate\):/);
  assert.match(text, /Missing context is not proof of a problem/);
});

test('a state over 32k but under 64k is refused', () => {
  const request = buildRequestBody(
    stateWith({ body: 'x'.repeat(40_000) }),
    'jev-latest',
  );
  assert.equal(requestFitsBudget(request), false);
});

test('an envelope without a model keeps it undefined', () => {
  const parsed = parseEnvelope('{"answers":{}}');
  assert.equal(parsed?.model, undefined);
});
