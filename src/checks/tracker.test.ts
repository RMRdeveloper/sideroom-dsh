import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createCheckTracker } from '@/checks/tracker.js';

async function fixtureDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'sideroom-checks-'));
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test', check: 'tsc --noEmit' } }),
  );
  await writeFile(join(directory, 'pnpm-lock.yaml'), '');
  return directory;
}

test('detects the check command from the manifest and lockfile', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.refresh('agent-1', directory);
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: 'pnpm check',
      green: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('an exact successful check turns green', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: 'pnpm check',
      green: true,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('extra arguments do not confirm the check', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check -- --help',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a check joined with another command does not confirm', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'cd site && pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a different command does not confirm the check', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm test',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a failed rerun clears a previous green result', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-2',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-2',
      cwd: directory,
      succeeded: false,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a mutation clears the green result but keeps the command', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    tracker.observeMutation('agent-1', directory);
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: 'pnpm check',
      green: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a check started before a mutation cannot turn green after it', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeMutation('agent-1', directory);
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a green result belongs to its own directory', async () => {
  const first = await fixtureDirectory();
  const second = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: first,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: first,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', first).green, true);
    assert.equal(tracker.statusOf('agent-1', second).green, false);
  } finally {
    await rm(first, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
  }
});

test('the same turn keeps its state and a new turn forgets it', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    tracker.beginTurn('agent-1', 1);
    assert.equal(tracker.statusOf('agent-1', directory).green, true);
    tracker.beginTurn('agent-1', 2);
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: null,
      green: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a directory without a known check command reports none', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sideroom-empty-'));
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.refresh('agent-1', directory);
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: null,
      green: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('startShell records the command before the result', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: 'pnpm check',
      green: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a result without a start is ignored', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'missing',
      cwd: directory,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a result from another agent or directory is ignored', async () => {
  const directory = await fixtureDirectory();
  const other = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-2',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: other,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});

test('unknown status reads as no check', () => {
  const tracker = createCheckTracker();
  assert.deepEqual(tracker.statusOf('missing', '/missing'), {
    command: null,
    green: false,
  });
});

test('a new turn clears a started check', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.beginTurn('agent-1', 2);
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a check started after a mutation can turn green', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    tracker.observeMutation('agent-1', directory);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm check',
    });
    tracker.observeShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      succeeded: true,
    });
    assert.equal(tracker.statusOf('agent-1', directory).green, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('startShell ignores a command that does not match', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    await tracker.startShell({
      agentId: 'agent-1',
      callId: 'call-1',
      cwd: directory,
      commandLine: 'pnpm test',
    });
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: null,
      green: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('observeMutation creates state for an unknown directory', async () => {
  const directory = await fixtureDirectory();
  try {
    const tracker = createCheckTracker();
    tracker.beginTurn('agent-1', 1);
    tracker.observeMutation('agent-1', directory);
    assert.deepEqual(tracker.statusOf('agent-1', directory), {
      command: null,
      green: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
