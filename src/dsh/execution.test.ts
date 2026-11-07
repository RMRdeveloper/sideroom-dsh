import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Context } from '@deepseek-ai/cordis';
import type { ToolExecution } from '@deepseek-ai/dsh-tools';
import {
  mutationInspectionOf,
  tryReadPreviousText,
  tryWorkingDirectory,
  workingDirectoryOf,
} from '@/dsh/execution.js';

function contextWith(services: Record<string, unknown>): Context {
  return {
    get: (name: string) => services[name],
  } as unknown as Context;
}

function execWith(
  overrides: Record<string, unknown> = {},
): ToolExecution {
  return {
    name: 'write',
    arguments: { file_path: 'src/app.ts', content: 'next\n' },
    callId: 'call-1',
    agent: { id: 'agent-1', session: {} },
    signal: undefined,
    ...overrides,
  } as unknown as ToolExecution;
}

test('tryWorkingDirectory reads the session working directory', () => {
  const context = contextWith({
    workingDirectory: {
      get: (session: unknown) => {
        assert.deepEqual(session, { id: 'session-1' });
        return '/work';
      },
    },
  });
  const exec = execWith({ agent: { id: 'agent-1', session: { id: 'session-1' } } });
  assert.equal(tryWorkingDirectory(context, exec), '/work');
});

test('tryWorkingDirectory returns undefined without a service or session', () => {
  assert.equal(tryWorkingDirectory(contextWith({}), execWith()), undefined);
  const context = contextWith({
    workingDirectory: { get: () => '/work' },
  });
  assert.equal(
    tryWorkingDirectory(context, execWith({ agent: { id: 'agent-1' } })),
    undefined,
  );
  assert.equal(
    tryWorkingDirectory(context, execWith({ agent: undefined })),
    undefined,
  );
});

test('tryWorkingDirectory refuses to throw when the service fails', () => {
  const context = contextWith({
    workingDirectory: {
      get: () => {
        throw new Error('broken');
      },
    },
  });
  assert.equal(tryWorkingDirectory(context, execWith()), undefined);
});

test('workingDirectoryOf falls back to the process directory', () => {
  assert.equal(workingDirectoryOf(contextWith({}), execWith()), process.cwd());
});

test('reading a previous file without a filesystem reports absent', async () => {
  assert.deepEqual(
    await tryReadPreviousText(contextWith({}), execWith(), 'src/app.ts'),
    { kind: 'absent' },
  );
});

test('reading a previous file returns its text', async () => {
  const calls: unknown[] = [];
  const context = contextWith({
    fs: {
      resolve: (path: string, options: unknown) => {
        calls.push(path, options);
        return Promise.resolve({ targetKey: 'target' });
      },
      stat: () => Promise.resolve({ type: 'file' }),
      readText: () => Promise.resolve('old\n'),
    },
    workingDirectory: { get: () => '/work' },
  });
  assert.deepEqual(
    await tryReadPreviousText(context, execWith(), 'src/app.ts'),
    { kind: 'text', text: 'old\n' },
  );
  assert.deepEqual(calls, [
    'src/app.ts',
    { cwd: '/work', signal: undefined },
  ]);
});

test('a missing or non-file target reports absent', async () => {
  const context = contextWith({
    fs: {
      resolve: () => Promise.resolve({ targetKey: 'target' }),
      stat: () => Promise.resolve(undefined),
      readText: () => Promise.resolve('never'),
    },
  });
  assert.deepEqual(
    await tryReadPreviousText(context, execWith(), 'src/app.ts'),
    { kind: 'absent' },
  );

  const directoryContext = contextWith({
    fs: {
      resolve: () => Promise.resolve({ targetKey: 'target' }),
      stat: () => Promise.resolve({ type: 'directory' }),
      readText: () => Promise.resolve('never'),
    },
  });
  assert.deepEqual(
    await tryReadPreviousText(directoryContext, execWith(), 'src/app.ts'),
    { kind: 'absent' },
  );
});

test('a missing path during the read reports absent', async () => {
  const context = contextWith({
    fs: {
      resolve: () =>
        Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' })),
      stat: () => Promise.resolve(undefined),
      readText: () => Promise.resolve(''),
    },
  });
  assert.deepEqual(
    await tryReadPreviousText(context, execWith(), 'src/app.ts'),
    { kind: 'absent' },
  );
});

test('another filesystem error still reports absent', async () => {
  const context = contextWith({
    fs: {
      resolve: () =>
        Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })),
      stat: () => Promise.resolve(undefined),
      readText: () => Promise.resolve(''),
    },
  });
  assert.deepEqual(
    await tryReadPreviousText(context, execWith(), 'src/app.ts'),
    { kind: 'absent' },
  );

  const otherContext = contextWith({
    fs: {
      resolve: () => Promise.reject(new Error('boom')),
      stat: () => Promise.resolve(undefined),
      readText: () => Promise.resolve(''),
    },
  });
  assert.deepEqual(
    await tryReadPreviousText(otherContext, execWith(), 'src/app.ts'),
    { kind: 'absent' },
  );
});

test('a mutation inspection without an agent is ignored', async () => {
  const exec = execWith({ agent: undefined });
  assert.equal(await mutationInspectionOf(contextWith({}), exec), null);
});

test('a write inspection reports its path and added lines', async () => {
  const inspection = await mutationInspectionOf(
    contextWith({}),
    execWith(),
  );
  assert.deepEqual(inspection, {
    toolName: 'write',
    changes: [{ path: 'src/app.ts', added: ['next'] }],
    callId: 'call-1',
    agentId: 'agent-1',
  });
});

test('a write inspection subtracts the previous file', async () => {
  const context = contextWith({
    fs: {
      resolve: () => Promise.resolve({ targetKey: 'target' }),
      stat: () => Promise.resolve({ type: 'file' }),
      readText: () => Promise.resolve('old\n'),
    },
  });
  const inspection = await mutationInspectionOf(context, execWith());
  assert.deepEqual(inspection?.changes, [
    { path: 'src/app.ts', added: ['next'] },
  ]);
});

test('an edit inspection reports the changed text', async () => {
  const exec = execWith({
    name: 'edit',
    arguments: {
      file_path: 'src/app.ts',
      old_string: 'a',
      new_string: 'b',
    },
  });
  const inspection = await mutationInspectionOf(contextWith({}), exec);
  assert.deepEqual(inspection?.changes, [{ path: 'src/app.ts', added: ['b'] }]);
});

test('an apply_patch inspection reports every file', async () => {
  const exec = execWith({
    name: 'apply_patch',
    arguments: {
      input: '*** Begin Patch\n*** Add File: a.ts\n+x\n*** End Patch',
    },
  });
  const inspection = await mutationInspectionOf(contextWith({}), exec);
  assert.deepEqual(inspection?.changes, [{ path: 'a.ts', added: ['x'] }]);
});

test('an unknown tool is not inspected', async () => {
  const exec = execWith({ name: 'read' });
  assert.equal(await mutationInspectionOf(contextWith({}), exec), null);
});
