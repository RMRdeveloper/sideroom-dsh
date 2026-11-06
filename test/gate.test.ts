import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coversLanguage, gateDecision } from '../src/guidelines/gate.js'
import { createRunStore } from '../src/state/store.js'

const OPEN: { enabled: boolean; gateUnrecognized: boolean } = {
  enabled: true,
  gateUnrecognized: false,
}

test('blocks a mutation until the contract and language slots are loaded', () => {
  const store = createRunStore()
  const denial = gateDecision({
    store,
    settings: OPEN,
    agentId: 'agent-1',
    toolName: 'write',
    target: 'src/app.ts',
    language: 'typescript',
  })
  assert.equal(denial?.kind, 'deny')
  assert.match(denial?.reason ?? '', /sideroom_guidelines/)
})

test('allows the mutation once both slots are loaded', () => {
  const store = createRunStore()
  store.markLoaded('agent-1', 'contract')
  store.markLoaded('agent-1', 'typescript')
  const denial = gateDecision({
    store,
    settings: OPEN,
    agentId: 'agent-1',
    toolName: 'write',
    target: 'src/app.ts',
    language: 'typescript',
  })
  assert.equal(denial, null)
})

test('a different language still requires its own slot', () => {
  const store = createRunStore()
  store.markLoaded('agent-1', 'contract')
  store.markLoaded('agent-1', 'typescript')
  const denial = gateDecision({
    store,
    settings: OPEN,
    agentId: 'agent-1',
    toolName: 'edit',
    target: 'src/app.py',
    language: 'python',
  })
  assert.equal(denial?.kind, 'deny')
})

test('unrecognized files pass when the gate ignores them', () => {
  const store = createRunStore()
  const denial = gateDecision({
    store,
    settings: OPEN,
    agentId: 'agent-1',
    toolName: 'edit',
    target: 'notes.md',
    language: 'general',
  })
  assert.equal(denial, null)
})

test('unrecognized files are gated when the gate covers them', () => {
  const store = createRunStore()
  const denial = gateDecision({
    store,
    settings: { enabled: true, gateUnrecognized: true },
    agentId: 'agent-1',
    toolName: 'edit',
    target: 'notes.md',
    language: 'general',
  })
  assert.equal(denial?.kind, 'deny')
})

test('a disabled gate never denies', () => {
  const store = createRunStore()
  const denial = gateDecision({
    store,
    settings: { enabled: false, gateUnrecognized: false },
    agentId: 'agent-1',
    toolName: 'write',
    target: 'src/app.ts',
    language: 'typescript',
  })
  assert.equal(denial, null)
})

test('the layer covers a file only when its language is known or gating is on', () => {
  assert.equal(coversLanguage(OPEN, 'general'), false)
  assert.equal(coversLanguage(OPEN, 'typescript'), true)
  assert.equal(
    coversLanguage({ enabled: true, gateUnrecognized: true }, 'general'),
    true
  )
})
