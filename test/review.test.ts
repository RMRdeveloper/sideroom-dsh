import assert from 'node:assert/strict'
import { test } from 'node:test'
import { promptSections } from '../src/prompt.js'
import { reviewText } from '../src/review.js'

test('the review names the detected command when it is known', () => {
  const text = reviewText({ command: 'pnpm check', green: false })
  assert.match(text, /Detected check command: `pnpm check`/)
  assert.doesNotMatch(text, /Checks already green/)
})

test('the review reuses a green result instead of asking again', () => {
  const text = reviewText({ command: 'pnpm check', green: true })
  assert.match(text, /Checks already green this run: `pnpm check`/)
  assert.doesNotMatch(text, /Detected check command/)
})

test('the review omits the command when detection found none', () => {
  const text = reviewText({ command: null, green: false })
  assert.doesNotMatch(text, /Detected check command/)
  assert.match(text, /Run the project formatter/)
})

test('both prompt sections are registered in order', () => {
  const sections = promptSections({ contract: true, explain: true })
  assert.deepEqual(
    sections.map((section) => [section.name, section.order]),
    [
      ['sideroom.contract', 900],
      ['sideroom.explain', 901],
    ]
  )
})

test('a disabled prompt section is not registered', () => {
  const explainOnly = promptSections({ contract: false, explain: true })
  assert.deepEqual(
    explainOnly.map((section) => section.name),
    ['sideroom.explain']
  )
  assert.deepEqual(promptSections({ contract: false, explain: false }), [])
})
