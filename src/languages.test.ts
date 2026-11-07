import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createGuides } from '@/guidelines/guides.js';
import {
  GENERAL_LANGUAGE,
  guideFileFor,
  languageOfPath,
  usesBraces,
} from '@/languages.js';

const PACKAGE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

test('maps every supported extension to a language', () => {
  const expected: Array<[string, string]> = [
    ['app.ts', 'typescript'],
    ['app.tsx', 'typescript'],
    ['app.mts', 'typescript'],
    ['app.cts', 'typescript'],
    ['app.js', 'javascript'],
    ['app.jsx', 'javascript'],
    ['app.mjs', 'javascript'],
    ['app.cjs', 'javascript'],
    ['app.py', 'python'],
    ['app.pyi', 'python'],
    ['app.go', 'go'],
    ['app.rs', 'rust'],
    ['app.java', 'java'],
    ['app.php', 'php'],
  ];
  for (const [path, language] of expected) {
    assert.equal(languageOfPath(path), language, path);
  }
});

test('language matching is case-insensitive and ignores directories', () => {
  assert.equal(languageOfPath('src/APP.TS'), 'typescript');
  assert.equal(languageOfPath('a/b/c/app.Py'), 'python');
  assert.equal(languageOfPath('  app.ts  '), 'typescript');
});

test('unknown extensions and missing extensions use the general language', () => {
  assert.equal(GENERAL_LANGUAGE, 'general');
  assert.equal(languageOfPath('notes.md'), GENERAL_LANGUAGE);
  assert.equal(languageOfPath('Makefile'), GENERAL_LANGUAGE);
  assert.equal(languageOfPath('app.'), GENERAL_LANGUAGE);
  assert.equal(languageOfPath(''), GENERAL_LANGUAGE);
});

test('every language maps to its guide', () => {
  assert.equal(guideFileFor('typescript'), 'typescript');
  assert.equal(guideFileFor('javascript'), 'javascript');
  assert.equal(guideFileFor('python'), 'python');
  assert.equal(guideFileFor('go'), 'go');
  assert.equal(guideFileFor('rust'), 'rust');
  assert.equal(guideFileFor('java'), 'java');
  assert.equal(guideFileFor('php'), 'php-laravel');
  assert.equal(guideFileFor('general'), null);
  assert.equal(guideFileFor('cobol'), null);
});

test('only brace languages are checked for braces', () => {
  assert.equal(usesBraces('typescript'), true);
  assert.equal(usesBraces('javascript'), true);
  assert.equal(usesBraces('java'), true);
  assert.equal(usesBraces('php'), true);
  assert.equal(usesBraces('python'), false);
  assert.equal(usesBraces('go'), false);
  assert.equal(usesBraces('rust'), false);
  assert.equal(usesBraces('general'), false);
});

test('each language guide carries its own heading', () => {
  const guides = createGuides(PACKAGE_ROOT);
  const headings: Array<[string, RegExp]> = [
    ['typescript', /TypeScript Coding Guidelines/],
    ['javascript', /JavaScript Coding Guidelines/],
    ['python', /Python Coding Guidelines/],
    ['go', /Go Coding Guidelines/],
    ['rust', /Rust Coding Guidelines/],
    ['java', /Java Coding Guidelines/],
    ['php', /PHP \/ Laravel Coding Guidelines/],
  ];
  for (const [language, heading] of headings) {
    assert.match(guides.load(language), heading, language);
  }
});

test('the packaged guide carries the contract and the language addendum', () => {
  const guides = createGuides(PACKAGE_ROOT);
  const typescript = guides.load('typescript');
  assert.match(typescript, /Sideroom guidelines/);
  assert.match(typescript, /TypeScript Coding Guidelines/);
});

test('an unsupported language receives the shared contract only', () => {
  const guides = createGuides(PACKAGE_ROOT);
  const shared = guides.load('cobol');
  assert.match(shared, /Sideroom guidelines/);
  assert.doesNotMatch(shared, /TypeScript Coding Guidelines/);
});

test('a missing package asset fails fast instead of returning an empty guide', () => {
  const brokenRoot = join(PACKAGE_ROOT, 'missing-package-root');
  assert.throws(() => createGuides(brokenRoot), /cannot read guideline asset/);
});

test('a non-string path falls back to the general language', () => {
  assert.equal(languageOfPath(42 as unknown as string), GENERAL_LANGUAGE);
});

test('only the final extension decides the language', () => {
  assert.equal(languageOfPath('src/app.ts.bak'), GENERAL_LANGUAGE);
  assert.equal(languageOfPath('src/app.bak.ts'), 'typescript');
});
