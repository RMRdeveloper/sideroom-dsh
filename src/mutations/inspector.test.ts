import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS } from '@/config.js';
import type { MutationInspection } from '@/mutations/changes.js';
import { createMutationInspector } from '@/mutations/inspector.js';
import { createPendingNotes } from '@/mutations/pending-notes.js';
import { createRunStore } from '@/state/store.js';

const SETTINGS = {
  guidelines: { enabled: true, gateUnrecognized: false },
  rules: { ...DEFAULTS.rules, enabled: true },
};

function loadedStore(): ReturnType<typeof createRunStore> {
  const store = createRunStore();
  store.markLoaded('agent-1', 'contract');
  store.markLoaded('agent-1', 'typescript');
  return store;
}

function inspection(
  changes: MutationInspection['changes'],
  toolName = 'write',
): MutationInspection {
  return { toolName, changes, callId: 'call-1', agentId: 'agent-1' };
}

test('the inspector denies the first mutation before the guide is loaded', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: createRunStore(),
    notes: createPendingNotes(),
  });
  const denial = await inspector.inspect(
    inspection([{ path: 'src/app.ts', added: ['export const a = 1'] }]),
  );
  assert.equal(denial?.kind, 'deny');
  assert.match(denial?.reason ?? '', /not loaded/);
});

test('the inspector blocks a guideline violation in the added lines', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes: createPendingNotes(),
  });
  const denial = await inspector.inspect(
    inspection([
      {
        path: 'src/app.ts',
        added: ['export function read(user) {', '  if (!user) return 0;', '}'],
      },
    ]),
  );
  assert.equal(denial?.kind, 'deny');
  assert.match(denial?.reason ?? '', /rule 1 Braced conditionals/);
});

test('the inspector only inspects added lines, not the whole file', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes: createPendingNotes(),
  });
  const denial = await inspector.inspect(
    inspection([{ path: 'src/app.ts', added: ['export const total = 1;'] }]),
  );
  assert.equal(denial, null);
});

test('a note keeps the call pending while a clean write keeps nothing', async () => {
  const notes = createPendingNotes();
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes,
  });

  const clean = await inspector.inspect(
    inspection([{ path: 'src/app.ts', added: ['export const a = 1'] }]),
  );
  assert.equal(clean, null);
  assert.equal(notes.take('call-1'), undefined);

  const noted = await inspector.inspect(
    inspection([
      { path: 'src/app.ts', added: ['export const a = 1', 'console.log(a)'] },
    ]),
  );
  assert.equal(noted, null);
  const pending = notes.take('call-1');
  assert.ok(
    pending?.[0]?.notes.some((note) => note.rule === 'debug-artifacts'),
  );
  assert.equal(notes.take('call-1'), undefined);
});

test('a non-mutation tool is ignored', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: createRunStore(),
    notes: createPendingNotes(),
  });
  const denial = await inspector.inspect(
    inspection([{ path: 'src/app.ts', added: ['const a = 1'] }], 'read'),
  );
  assert.equal(denial, null);
});

test('a file without a code language is not inspected at all', async () => {
  const notes = createPendingNotes();
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes,
  });
  const denial = await inspector.inspect(
    inspection([
      {
        path: 'notes.md',
        added: ['const data = 1', 'console.log(data)'],
      },
    ]),
  );
  assert.equal(denial, null);
  assert.equal(notes.take('call-1'), undefined);
});

test('a multi-file mutation reports every missing guide', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: createRunStore(),
    notes: createPendingNotes(),
  });
  const denial = await inspector.inspect(
    inspection(
      [
        { path: 'src/app.ts', added: ['export const a = 1'] },
        { path: 'src/app.py', added: ['VALUE = 1'] },
      ],
      'apply_patch',
    ),
  );
  assert.equal(denial?.kind, 'deny');
  assert.match(denial?.reason ?? '', /src\/app\.py \(python\)/);
  assert.match(denial?.reason ?? '', /src\/app\.ts \(typescript\)/);
});

test('a blocking line in the second file names that file', async () => {
  const inspector = createMutationInspector({
    settings: SETTINGS,
    store: loadedStore(),
    notes: createPendingNotes(),
  });
  const denial = await inspector.inspect(
    inspection(
      [
        { path: 'src/first.ts', added: ['export const a = 1;'] },
        { path: 'src/second.ts', added: ['if (!user) return 0;'] },
      ],
      'apply_patch',
    ),
  );
  assert.equal(denial?.kind, 'deny');
  assert.match(denial?.reason ?? '', /src\/second\.ts/);
});
