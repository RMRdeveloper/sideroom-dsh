import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changesOf,
  isMutationCall,
  type PreviousContent,
} from '@/mutations/changes.js';

const NO_PREVIOUS = (): Promise<PreviousContent> =>
  Promise.resolve({ kind: 'absent' });

test('a write diffs its content against the previous file', async () => {
  const changes = await changesOf({
    toolName: 'write',
    arguments: { file_path: 'src/app.ts', content: 'a\nb\n' },
    readPrevious: (): Promise<PreviousContent> =>
      Promise.resolve({ kind: 'text', text: 'a\n' }),
  });
  assert.deepEqual(changes, [{ path: 'src/app.ts', added: ['b'] }]);
});

test('a write to a new file treats every line as added', async () => {
  const changes = await changesOf({
    toolName: 'write',
    arguments: { file_path: 'src/app.ts', content: 'a\n\nb\n' },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [{ path: 'src/app.ts', added: ['a', 'b'] }]);
});

test('an edit compares its old and new text', async () => {
  const changes = await changesOf({
    toolName: 'edit',
    arguments: {
      file_path: 'src/app.ts',
      old_string: 'const a = 1',
      new_string: 'const b = 2',
    },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [{ path: 'src/app.ts', added: ['const b = 2'] }]);
});

test('str_replace_editor create and insert add their new text', async () => {
  const created = await changesOf({
    toolName: 'str_replace_editor',
    arguments: {
      command: 'create',
      path: 'src/new.ts',
      file_text: 'a\nb',
    },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(created, [{ path: 'src/new.ts', added: ['a', 'b'] }]);

  const inserted = await changesOf({
    toolName: 'str_replace_editor',
    arguments: {
      command: 'insert',
      path: 'src/app.ts',
      insert_line: 0,
      new_str: 'a\nb',
    },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(inserted, [{ path: 'src/app.ts', added: ['a', 'b'] }]);
});

test('str_replace_editor str_replace diffs its old and new text', async () => {
  const changes = await changesOf({
    toolName: 'str_replace_editor',
    arguments: {
      command: 'str_replace',
      path: 'src/app.ts',
      old_str: 'const a = 1',
      new_str: 'const b = 2',
    },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [{ path: 'src/app.ts', added: ['const b = 2'] }]);
});

test('a read-only editor command is not a mutation', async () => {
  const changes = await changesOf({
    toolName: 'str_replace_editor',
    arguments: { command: 'view', path: 'src/app.ts' },
    readPrevious: NO_PREVIOUS,
  });
  assert.equal(changes, null);
});

test('apply_patch reports added, updated, deleted and moved files', async () => {
  const patch = [
    '*** Begin Patch',
    '*** Add File: src/new.ts',
    '+export const added = 1',
    '*** Update File: src/app.ts',
    '@@',
    '-const old = 1',
    '+const next = 2',
    '*** Delete File: src/gone.ts',
    '*** Update File: src/moved.ts',
    '*** Move to: src/renamed.ts',
    '+const moved = 3',
    '*** End Patch',
  ].join('\n');

  const changes = await changesOf({
    toolName: 'apply_patch',
    arguments: { input: patch },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [
    { path: 'src/new.ts', added: ['export const added = 1'] },
    { path: 'src/app.ts', added: ['const next = 2'] },
    { path: 'src/gone.ts', added: [] },
    { path: 'src/moved.ts', added: [] },
    { path: 'src/renamed.ts', added: ['const moved = 3'] },
  ]);
});

test('an empty patch is not a mutation', async () => {
  const changes = await changesOf({
    toolName: 'apply_patch',
    arguments: { input: '   ' },
    readPrevious: NO_PREVIOUS,
  });
  assert.equal(changes, null);
});

test('mutation calls exclude read-only commands and empty patches', () => {
  assert.equal(
    isMutationCall('str_replace_editor', { command: 'view' }),
    false,
  );
  assert.equal(
    isMutationCall('str_replace_editor', { command: 'create' }),
    true,
  );
  assert.equal(isMutationCall('apply_patch', { input: '   ' }), false);
  assert.equal(
    isMutationCall('apply_patch', {
      input: '*** Begin Patch\n*** End Patch',
    }),
    false,
  );
  assert.equal(isMutationCall('write', {}), true);
  assert.equal(isMutationCall('edit', {}), true);
});

test('a write accepts the path argument and reports null without a target', async () => {
  const changes = await changesOf({
    toolName: 'write',
    arguments: { path: 'src/app.ts', content: 'a' },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [{ path: 'src/app.ts', added: ['a'] }]);

  assert.equal(
    await changesOf({
      toolName: 'write',
      arguments: {},
      readPrevious: NO_PREVIOUS,
    }),
    null,
  );
});

test('an edit without a target is not inspected', async () => {
  assert.equal(
    await changesOf({
      toolName: 'edit',
      arguments: {},
      readPrevious: NO_PREVIOUS,
    }),
    null,
  );
  const changes = await changesOf({
    toolName: 'edit',
    arguments: { path: 'src/app.ts' },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [{ path: 'src/app.ts', added: [] }]);
});

test('editor commands without a path or with an unknown command are ignored', async () => {
  for (const args of [
    {},
    { command: 'create', path: '' },
    { command: 'unknown', path: 'src/app.ts' },
  ]) {
    assert.equal(
      await changesOf({
        toolName: 'str_replace_editor',
        arguments: args,
        readPrevious: NO_PREVIOUS,
      }),
      null,
      JSON.stringify(args),
    );
  }
});

test('an editor create without text adds nothing', async () => {
  assert.deepEqual(
    await changesOf({
      toolName: 'str_replace_editor',
      arguments: { command: 'create', path: 'src/new.ts' },
      readPrevious: NO_PREVIOUS,
    }),
    [{ path: 'src/new.ts', added: [] }],
  );
});

test('an editor str_replace without new text removes lines only', async () => {
  assert.deepEqual(
    await changesOf({
      toolName: 'str_replace_editor',
      arguments: {
        command: 'str_replace',
        path: 'src/app.ts',
        old_str: 'const a = 1',
      },
      readPrevious: NO_PREVIOUS,
    }),
    [{ path: 'src/app.ts', added: [] }],
  );
});

test('quoted patch paths are unquoted', async () => {
  const changes = await changesOf({
    toolName: 'apply_patch',
    arguments: {
      input: [
        '*** Begin Patch',
        '*** Add File: "src/quoted.ts"',
        '+export const a = 1',
        '*** End Patch',
      ].join('\n'),
    },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [
    { path: 'src/quoted.ts', added: ['export const a = 1'] },
  ]);
});

test('blank added patch lines and marker-only patches add nothing', async () => {
  assert.equal(
    await changesOf({
      toolName: 'apply_patch',
      arguments: { input: '*** Begin Patch\n*** End Patch' },
      readPrevious: NO_PREVIOUS,
    }),
    null,
  );
  assert.deepEqual(
    await changesOf({
      toolName: 'apply_patch',
      arguments: {
        input: '*** Begin Patch\n*** Add File: src/a.ts\n+\n*** End Patch',
      },
      readPrevious: NO_PREVIOUS,
    }),
    [{ path: 'src/a.ts', added: [] }],
  );
});

test('a move records both the source and the destination', async () => {
  const changes = await changesOf({
    toolName: 'apply_patch',
    arguments: {
      input: [
        '*** Begin Patch',
        '*** Update File: src/source.ts',
        '*** Move to: src/destination.ts',
        '+export const moved = 1',
        '*** End Patch',
      ].join('\n'),
    },
    readPrevious: NO_PREVIOUS,
  });
  assert.deepEqual(changes, [
    { path: 'src/source.ts', added: [] },
    { path: 'src/destination.ts', added: ['export const moved = 1'] },
  ]);
});

test('an unknown tool is not a mutation', () => {
  assert.equal(isMutationCall('read', {}), false);
  assert.equal(isMutationCall('str_replace_editor', { command: 'insert' }), true);
  assert.equal(isMutationCall('str_replace_editor', { command: 'str_replace' }), true);
  assert.equal(
    isMutationCall('apply_patch', {
      input: '*** Begin Patch\n*** Add File: src/a.ts\n+x\n*** End Patch',
    }),
    true,
  );
});
