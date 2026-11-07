import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addedLines } from '@/mutations/added-lines.js';

test('added lines diffs a write against the previous content', () => {
  assert.deepEqual(addedLines(null, 'a\n\nb'), ['a', 'b']);
  assert.deepEqual(addedLines('a\nb', 'a\nc'), ['c']);
});

test('added lines diffs an edit between old and new text', () => {
  assert.deepEqual(addedLines('const a = 1', 'const b = 2'), ['const b = 2']);
});

test('a null previous file keeps every non-blank line', () => {
  assert.deepEqual(addedLines(null, 'one\n\n two \nthree'), [
    'one',
    ' two ',
    'three',
  ]);
});

test('blank lines are never reported as additions', () => {
  assert.deepEqual(addedLines('a', '\n  \n\t\nb\n'), ['b']);
});

test('CRLF files are compared line by line', () => {
  assert.deepEqual(addedLines('a\r\nb', 'a\r\nc'), ['c']);
});

test('existing lines are compared after trimming', () => {
  assert.deepEqual(addedLines('  a  \n b', 'a\nb\nc'), ['c']);
});

test('a duplicated existing line is subtracted once per set membership', () => {
  assert.deepEqual(addedLines('a', 'a\na'), []);
});

test('an empty result yields no additions', () => {
  assert.deepEqual(addedLines('a\nb', ''), []);
  assert.deepEqual(addedLines('', 'a'), ['a']);
});

test('a line that matches the mutation sentinel is still an addition', () => {
  assert.deepEqual(addedLines(null, 'Stryker was here'), ['Stryker was here']);
});

test('whitespace-only lines are never additions', () => {
  assert.deepEqual(addedLines(null, ' \t '), []);
});
