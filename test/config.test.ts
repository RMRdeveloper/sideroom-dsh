import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULTS, normalizeConfig } from '../src/config.js'

test('an absent config resolves to the shipped defaults', () => {
  const { settings, warnings } = normalizeConfig(undefined)
  assert.deepEqual(settings, DEFAULTS)
  assert.deepEqual(warnings, [])
})

test('a partial config overrides only the keys it names', () => {
  const { settings } = normalizeConfig({
    rules: { blocking: ['clear-names'], degradeAfter: 7 },
  })
  assert.deepEqual(settings.rules.blocking, ['clear-names'])
  assert.equal(settings.rules.degradeAfter, 7)
  assert.equal(settings.rules.resetAfter, DEFAULTS.rules.resetAfter)
})

test('an unknown rule id fails fast at load time', () => {
  assert.throws(
    () => normalizeConfig({ rules: { blocking: ['braced-conditional'] } }),
    /unknown rule ids/
  )
})

test('a section that is not an object fails fast', () => {
  assert.throws(
    () => normalizeConfig({ rules: 'strict' }),
    /config\.rules must be an object/
  )
})

test('a non-boolean flag fails fast', () => {
  assert.throws(
    () => normalizeConfig({ review: { enabled: 'yes' } }),
    /config\.review\.enabled must be a boolean/
  )
})

test('a threshold that is not a non-negative integer fails fast', () => {
  assert.throws(
    () => normalizeConfig({ rules: { degradeAfter: 1.5 } }),
    /non-negative integer/
  )
})

test('an unknown setting is reported instead of applied silently', () => {
  const { warnings } = normalizeConfig({ review: { oncePerTurn: true } })
  assert.ok(
    warnings.some((warning) => warning.includes('config.review.oncePerTurn')),
    JSON.stringify(warnings)
  )
})

test('a rule configured in both lists is reported', () => {
  const { warnings } = normalizeConfig({
    rules: { blocking: ['clear-names'], notes: ['clear-names'] },
  })
  assert.ok(
    warnings.some((warning) => warning.includes('both blocking and a note')),
    JSON.stringify(warnings)
  )
})
