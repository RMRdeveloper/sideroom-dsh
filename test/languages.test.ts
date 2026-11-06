import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createGuides } from '../src/guidelines/guides.js'
import {
  GENERAL_LANGUAGE,
  guideFileFor,
  languageOfPath,
  usesBraces,
} from '../src/languages.js'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('maps extensions to a language, case-insensitively', () => {
  assert.equal(languageOfPath('src/app.ts'), 'typescript')
  assert.equal(languageOfPath('src/app.PY'), 'python')
  assert.equal(languageOfPath('src/app.php'), 'php')
  assert.equal(languageOfPath('notes.md'), GENERAL_LANGUAGE)
  assert.equal(languageOfPath('Makefile'), GENERAL_LANGUAGE)
})

test('maps php to the laravel guide and unknown languages to none', () => {
  assert.equal(guideFileFor('php'), 'php-laravel')
  assert.equal(guideFileFor('typescript'), 'typescript')
  assert.equal(guideFileFor('cobol'), null)
})

test('only brace languages are checked for braces', () => {
  assert.equal(usesBraces('typescript'), true)
  assert.equal(usesBraces('php'), true)
  assert.equal(usesBraces('python'), false)
  assert.equal(usesBraces('go'), false)
})

test('the packaged guide carries the contract and the language addendum', () => {
  const guides = createGuides(PACKAGE_ROOT)
  const typescript = guides.load('typescript')
  assert.match(typescript, /Sideroom guidelines/)
  assert.match(typescript, /TypeScript Coding Guidelines/)
})

test('an unsupported language receives the shared contract only', () => {
  const guides = createGuides(PACKAGE_ROOT)
  const shared = guides.load('cobol')
  assert.match(shared, /Sideroom guidelines/)
  assert.doesNotMatch(shared, /TypeScript Coding Guidelines/)
})

test('a missing package asset fails fast instead of returning an empty guide', () => {
  const brokenRoot = join(PACKAGE_ROOT, 'missing-package-root')
  assert.throws(() => createGuides(brokenRoot), /cannot read guideline asset/)
})
