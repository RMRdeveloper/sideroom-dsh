import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createJevCommand,
  JEV_COMMAND_NAME,
  jevCommandHelp,
  parseJevCommand,
} from '@/jev/command.js';
import { buildJevReport } from '@/jev/status.js';
import { JEV_STATUS } from '@/jev/state.js';

const REPORT = buildJevReport({
  enabled: true,
  keyEnv: 'TYPESAFE_API_KEY',
  key: { key: 'sk-secret', origin: 'environment' },
  model: 'jev-latest',
  cutoff: 0.8,
  gate: 0.6,
  runtime: JEV_STATUS.ready,
  calls: 1,
  muted: [],
});

function command(): ReturnType<typeof createJevCommand> {
  return createJevCommand({ report: () => Promise.resolve(REPORT) });
}

test('an empty input asks for the status', () => {
  assert.deepEqual(parseJevCommand(''), { kind: 'status' });
});

test('the status verb is selected with surrounding spaces', () => {
  assert.deepEqual(parseJevCommand('  status '), { kind: 'status' });
});

test('the help verb is selected', () => {
  assert.deepEqual(parseJevCommand('help'), { kind: 'help' });
});

test('an unknown verb keeps its text', () => {
  assert.deepEqual(parseJevCommand('key sk-secret'), {
    kind: 'unknown',
    verb: 'key sk-secret',
  });
});

test('the help lists both verbs and the key source', () => {
  const text = jevCommandHelp();
  assert.match(text, new RegExp(`^/${JEV_COMMAND_NAME} status`, 'mu'));
  assert.match(text, new RegExp(`^/${JEV_COMMAND_NAME} help`, 'mu'));
  assert.match(text, /jev\.keyEnv/u);
});

test('the default invocation answers with the report', async () => {
  const answer = await command().handler({ rawInput: '' });
  assert.equal(answer.kind, 'success');
  assert.match(answer.text, /^status: ready$/mu);
  assert.match(answer.text, /^calls: 1$/mu);
});

test('the help invocation answers with the help text', async () => {
  const answer = await command().handler({ rawInput: 'help' });
  assert.equal(answer.kind, 'success');
  assert.equal(answer.text, jevCommandHelp());
});

test('an unknown verb answers with an error naming it', async () => {
  const answer = await command().handler({ rawInput: 'enable' });
  assert.equal(answer.kind, 'error');
  assert.match(answer.text, /unknown \/jev verb "enable"/u);
});

test('the definition advertises the input verbs', () => {
  const definition = command();
  assert.equal(definition.name, JEV_COMMAND_NAME);
  assert.equal(definition.input.hint, '[status|help]');
});
