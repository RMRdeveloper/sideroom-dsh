import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stringArgument, targetPathOf } from '@/dsh/arguments.js';

test('a non-object argument list yields an empty string', () => {
  assert.equal(stringArgument(null, 'path'), '');
  assert.equal(stringArgument('text', 'path'), '');
  assert.equal(stringArgument(undefined, 'path'), '');
});

test('a missing or non-string argument yields an empty string', () => {
  assert.equal(stringArgument({}, 'path'), '');
  assert.equal(stringArgument({ path: 1 }, 'path'), '');
  assert.equal(stringArgument({ path: null }, 'path'), '');
});

test('a string argument is returned unchanged', () => {
  assert.equal(stringArgument({ path: '  src/app.ts  ' }, 'path'), '  src/app.ts  ');
});

test('targetPathOf prefers file_path and trims it', () => {
  assert.equal(
    targetPathOf({ file_path: '  src/app.ts ', path: 'src/other.ts' }),
    'src/app.ts',
  );
});

test('targetPathOf falls back to path', () => {
  assert.equal(targetPathOf({ file_path: '  ', path: ' src/app.ts ' }), 'src/app.ts');
});

test('targetPathOf returns null without a usable path', () => {
  assert.equal(targetPathOf(null), null);
  assert.equal(targetPathOf({}), null);
  assert.equal(targetPathOf({ file_path: '', path: '   ' }), null);
  assert.equal(targetPathOf({ file_path: 1, path: false }), null);
});
