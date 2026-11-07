import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMissingPathError } from '@/errors.js';

test('missing path codes are recognised', () => {
  assert.equal(isMissingPathError({ code: 'ENOENT' }), true);
  assert.equal(isMissingPathError({ code: 'ENOTDIR' }), true);
});

test('other codes and errors are rejected', () => {
  assert.equal(isMissingPathError({ code: 'EACCES' }), false);
  assert.equal(isMissingPathError({ code: 1 }), false);
  assert.equal(isMissingPathError({}), false);
});

test('non-object values are rejected', () => {
  assert.equal(isMissingPathError(null), false);
  assert.equal(isMissingPathError(undefined), false);
  assert.equal(isMissingPathError('ENOENT'), false);
  assert.equal(isMissingPathError(1), false);
});
