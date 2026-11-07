import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockBody,
  closingParen,
  isBlank,
  isLineComment,
  nextMeaningful,
} from '@/rules/detectors/lines.js';

test('blank lines are detected', () => {
  assert.equal(isBlank(''), true);
  assert.equal(isBlank('   '), true);
  assert.equal(isBlank('\t'), true);
  assert.equal(isBlank('x'), false);
});

test('line comments start with a slash pair or a hash', () => {
  assert.equal(isLineComment('// note'), true);
  assert.equal(isLineComment('# note'), true);
  assert.equal(isLineComment('/* note'), false);
  assert.equal(isLineComment('code // note'), false);
});

test('closingParen finds the matching parenthesis', () => {
  assert.equal(closingParen('f(a)', 1), 3);
  assert.equal(closingParen('f(g(a))', 1), 6);
  assert.equal(closingParen('f(a', 1), -1);
  assert.equal(closingParen('f)', 1), -1);
});

test('nextMeaningful skips blank lines', () => {
  assert.equal(nextMeaningful(['', '  ', 'value'], 0), 'value');
  assert.equal(nextMeaningful(['value'], 0), 'value');
  assert.equal(nextMeaningful(['', '  '], 0), null);
  assert.equal(nextMeaningful(['first', 'second'], 1), 'second');
});

test('blockBody collects meaningful lines until a closing brace', () => {
  assert.deepEqual(
    blockBody(['  one', '', '  // comment', '  * doc', '  two', '}'], 0),
    ['one', 'two'],
  );
});

test('blockBody stops at the first closing brace', () => {
  assert.deepEqual(blockBody(['  one', '  }', '  two'], 0), ['one']);
});

test('blockBody can return an empty body', () => {
  assert.deepEqual(blockBody(['  // only', '}'], 0), []);
  assert.deepEqual(blockBody([], 0), []);
});
