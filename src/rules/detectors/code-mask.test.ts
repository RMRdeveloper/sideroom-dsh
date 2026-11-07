import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maskCode } from '@/rules/detectors/code-mask.js';

const CODE = { keepComments: false };
const COMMENTS = { keepComments: true };

test('code without strings or comments is unchanged', () => {
  assert.deepEqual(maskCode(['const value = compute()'], CODE), [
    'const value = compute()',
  ]);
});

test('line comments are removed from code', () => {
  const [line] = maskCode(['const value = 1 // any'], CODE);
  assert.doesNotMatch(line, /any/);
  assert.match(line, /const value = 1/);
});

test('line comments are preserved when requested', () => {
  const [line] = maskCode(['const value = 1 // any'], COMMENTS);
  assert.match(line, /any/);
  assert.match(line, /const value = 1/);
});

test('strings are replaced with spaces', () => {
  const [line] = maskCode(['const value = "any"'], CODE);
  assert.doesNotMatch(line, /any/);
  assert.match(line, /const value = /);
});

test('single quoted strings and escapes are masked', () => {
  const [line] = maskCode([`const value = 'a\\'any' + tail`], CODE);
  assert.doesNotMatch(line, /any/);
  assert.match(line, /tail/);
});

test('template literals are masked', () => {
  const [line] = maskCode(['const value = `any ${name}` + tail'], CODE);
  assert.doesNotMatch(line, /any/);
  assert.match(line, /tail/);
});

test('block comments are removed across lines', () => {
  const masked = maskCode(['const a = 1 /* any', 'still any */ + b'], CODE);
  assert.doesNotMatch(masked[0], /any/);
  assert.doesNotMatch(masked[1], /any/);
  assert.match(masked[1], /\+ b/);
});

test('block comments are preserved when requested', () => {
  const masked = maskCode(['const a = 1 /* any', 'still any */ + b'], COMMENTS);
  assert.match(masked[0], /any/);
  assert.match(masked[1], /any/);
  assert.match(masked[1], /\+ b/);
});

test('strings are masked even when comments are preserved', () => {
  const [line] = maskCode(['const value = "hidden" // any'], COMMENTS);
  assert.doesNotMatch(line, /hidden/);
  assert.match(line, /any/);
});

test('a closed string returns to code mode', () => {
  const [line] = maskCode(['"hidden" + visible'], CODE);
  assert.doesNotMatch(line, /hidden/);
  assert.match(line, /\+ visible/);
});

test('an unterminated string masks the rest of the line', () => {
  const [line] = maskCode(['"hidden + any'], CODE);
  assert.doesNotMatch(line, /hidden/);
  assert.doesNotMatch(line, /any/);
});

test('a line comment ends at the next line', () => {
  const masked = maskCode(['// any', 'visible'], CODE);
  assert.doesNotMatch(masked[0], /any/);
  assert.equal(masked[1], 'visible');
});

test('a block comment end returns to code mode', () => {
  const [line] = maskCode(['/* any */ visible'], CODE);
  assert.doesNotMatch(line, /any/);
  assert.match(line, /visible/);
});

test('an unclosed block comment masks following lines', () => {
  const masked = maskCode(['/* any', 'hidden'], CODE);
  assert.doesNotMatch(masked[1], /hidden/);
});
