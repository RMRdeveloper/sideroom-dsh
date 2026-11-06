import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULTS } from '../src/config.js'
import { addedLines } from '../src/mutations/added-lines.js'
import {
  createMutationInspector,
  type MutationCall,
} from '../src/mutations/inspector.js'
import { createPendingNotes } from '../src/mutations/pending-notes.js'
import { createRunStore } from '../src/state/store.js'

const SETTINGS = {
  guidelines: { enabled: true, gateUnrecognized: false },
  rules: { ...DEFAULTS.rules, enabled: true },
}

function loadedStore(): ReturnType<typeof createRunStore> {
  const store = createRunStore()
  store.markLoaded('agent-1', 'contract')
  store.markLoaded('agent-1', 'typescript')
  return store
}

function writeCall(content: string, previous: string | null): MutationCall {
  return {
    toolName: 'write',
    arguments: { file_path: 'src/app.ts', content },
    callId: 'call-1',
    agentId: 'agent-1',
    readPrevious: async () =>
      previous === null ? { kind: 'absent' } : { kind: 'text', text: previous },
  }
}

test('added lines diffs a write against the previous content', () => {
  assert.deepEqual(addedLines(null, 'a\n\nb'), ['a', 'b'])
  assert.deepEqual(addedLines('a\nb', 'a\nc'), ['c'])
})

test('added lines diffs an edit between old and new text', () => {
  assert.deepEqual(addedLines('const a = 1', 'const b = 2'), ['const b = 2'])
})

test('the inspector denies the first mutation before the guide is loaded', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: createRunStore(),
    notes: createPendingNotes(),
  })
  const denial = await inspector.inspect(
    writeCall('export const a = 1\n', null)
  )
  assert.equal(denial?.kind, 'deny')
  assert.match(denial?.reason ?? '', /not loaded/)
})

test('the inspector blocks a guideline violation in the added lines', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes: createPendingNotes(),
  })
  const denial = await inspector.inspect(
    writeCall('export function read(user) {\n  if (!user) return 0;\n}\n', null)
  )
  assert.equal(denial?.kind, 'deny')
  assert.match(denial?.reason ?? '', /rule 1 Braced conditionals/)
})

test('the inspector only inspects added lines, not the whole file', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes: createPendingNotes(),
  })
  const denial = await inspector.inspect(
    writeCall(
      'if (!user) return 0;\nexport const total = 1;\n',
      'if (!user) return 0;\n'
    )
  )
  assert.equal(denial, null)
})

test('a note keeps the call pending while a clean write keeps nothing', async () => {
  const notes = createPendingNotes()
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes,
  })

  const clean = await inspector.inspect(writeCall('export const a = 1\n', null))
  assert.equal(clean, null)
  assert.equal(notes.take('call-1'), undefined)

  const noted = await inspector.inspect(
    writeCall('export const a = 1\nconsole.log(a)\n', 'export const a = 1\n')
  )
  assert.equal(noted, null)
  const pending = notes.take('call-1')
  assert.ok(pending?.notes.some((note) => note.rule === 'debug-artifacts'))
  assert.equal(notes.take('call-1'), undefined)
})

test('a non-mutation tool is ignored', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: createRunStore(),
    notes: createPendingNotes(),
  })
  const denial = await inspector.inspect({
    toolName: 'read',
    arguments: { file_path: 'src/app.ts' },
    callId: 'call-2',
    agentId: 'agent-1',
    readPrevious: async () => ({ kind: 'absent' }),
  })
  assert.equal(denial, null)
})

test('a file without a code language is not inspected at all', async () => {
  const notes = createPendingNotes()
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes,
  })
  const denial = await inspector.inspect({
    toolName: 'write',
    arguments: {
      file_path: 'notes.md',
      content: 'const data = 1\nconsole.log(data)\n',
    },
    callId: 'call-3',
    agentId: 'agent-1',
    readPrevious: async () => ({ kind: 'absent' }),
  })
  assert.equal(denial, null)
  assert.equal(notes.take('call-3'), undefined)
})
