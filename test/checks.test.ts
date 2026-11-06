import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createCheckTracker } from '../src/checks/tracker.js'

async function fixtureDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'sideroom-checks-'))
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test', check: 'tsc --noEmit' } })
  )
  await writeFile(join(directory, 'pnpm-lock.yaml'), '')
  return directory
}

test('detects the check command from the manifest and lockfile', async () => {
  const directory = await fixtureDirectory()
  try {
    const tracker = createCheckTracker()
    await tracker.refresh('agent-1', directory)
    assert.equal(tracker.statusOf('agent-1').command, 'pnpm check')
    assert.equal(tracker.statusOf('agent-1').green, false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('marks checks green only for the detected command', async () => {
  const directory = await fixtureDirectory()
  try {
    const tracker = createCheckTracker()
    tracker.beginTurn('agent-1')
    await tracker.observeShell({
      agentId: 'agent-1',
      cwd: directory,
      commandLine: 'pnpm test',
    })
    assert.equal(tracker.statusOf('agent-1').green, false)

    await tracker.observeShell({
      agentId: 'agent-1',
      cwd: directory,
      commandLine: 'pnpm check',
    })
    assert.deepEqual(tracker.statusOf('agent-1'), {
      command: 'pnpm check',
      green: true,
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a mutation clears the green result but keeps the command', async () => {
  const directory = await fixtureDirectory()
  try {
    const tracker = createCheckTracker()
    await tracker.observeShell({
      agentId: 'agent-1',
      cwd: directory,
      commandLine: 'pnpm check',
    })
    tracker.observeMutation('agent-1')
    assert.deepEqual(tracker.statusOf('agent-1'), {
      command: 'pnpm check',
      green: false,
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a new turn forgets the previous status', async () => {
  const directory = await fixtureDirectory()
  try {
    const tracker = createCheckTracker()
    await tracker.observeShell({
      agentId: 'agent-1',
      cwd: directory,
      commandLine: 'pnpm check',
    })
    tracker.beginTurn('agent-1')
    assert.deepEqual(tracker.statusOf('agent-1'), {
      command: null,
      green: false,
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a directory without a known check command reports none', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sideroom-empty-'))
  try {
    const tracker = createCheckTracker()
    await tracker.refresh('agent-1', directory)
    assert.deepEqual(tracker.statusOf('agent-1'), {
      command: null,
      green: false,
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
