import assert from 'node:assert/strict';
import { test } from 'node:test';
import { booleanField, parseFrontmatter } from '@/skills/frontmatter.js';

test('text without frontmatter keeps its body', () => {
  assert.deepEqual(parseFrontmatter('hello\nworld'), {
    fields: {},
    body: 'hello\nworld',
  });
});

test('parses fields and the body after the closing delimiter', () => {
  const parsed = parseFrontmatter(
    '---\nname: demo\ndescription: "A demo"\n---\nBody\n',
  );
  assert.deepEqual(parsed.fields, { name: 'demo', description: 'A demo' });
  assert.equal(parsed.body, 'Body\n');
});

test('accepts CRLF frontmatter', () => {
  const parsed = parseFrontmatter('---\r\nname: demo\r\n---\r\nBody');
  assert.deepEqual(parsed.fields, { name: 'demo' });
  assert.equal(parsed.body, 'Body');
});

test('strips one surrounding quote and trims values and keys', () => {
  const parsed = parseFrontmatter(
    '---\nname  :  \'demo\'  \nother: "value"\n---\n',
  );
  assert.deepEqual(parsed.fields, { name: 'demo', other: 'value' });
});

test('keeps keys with digits, underscores, hyphens and uppercase', () => {
  const parsed = parseFrontmatter(
    '---\nKey_1-name: yes\n---\n',
  );
  assert.deepEqual(parsed.fields, { 'Key_1-name': 'yes' });
});

test('skips malformed lines and keeps empty values', () => {
  const parsed = parseFrontmatter(
    '---\nname: demo\nnot a field\ndescription:\n---\nbody',
  );
  assert.deepEqual(parsed.fields, { name: 'demo', description: '' });
});

test('an unterminated block is not frontmatter', () => {
  const text = '---\nname: demo\n';
  assert.deepEqual(parseFrontmatter(text), { fields: {}, body: text });
});

test('an empty frontmatter block yields no fields', () => {
  assert.deepEqual(parseFrontmatter('---\n\n---\nbody'), {
    fields: {},
    body: 'body',
  });
});

test('a body without a trailing newline keeps its exact text', () => {
  assert.equal(parseFrontmatter('---\na: b\n---\nlast line').body, 'last line');
});

test('boolean fields accept every true spelling', () => {
  for (const raw of ['true', 'yes', 'on', '1', ' TRUE ', 'On']) {
    assert.equal(booleanField({ flag: raw }, 'flag', false), true, raw);
  }
});

test('boolean fields accept every false spelling', () => {
  for (const raw of ['false', 'no', 'off', '0', ' FALSE ', 'Off']) {
    assert.equal(booleanField({ flag: raw }, 'flag', true), false, raw);
  }
});

test('an unknown boolean spelling falls back', () => {
  assert.equal(booleanField({ flag: 'maybe' }, 'flag', true), true);
  assert.equal(booleanField({ flag: 'maybe' }, 'flag', false), false);
});

test('a missing boolean field falls back', () => {
  assert.equal(booleanField({}, 'flag', true), true);
  assert.equal(booleanField({}, 'flag', false), false);
});
