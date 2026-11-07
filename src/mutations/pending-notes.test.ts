import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPendingNotes } from '@/mutations/pending-notes.js';

const NOTE = { target: 'src/app.ts', notes: [] };

test('a remembered call is returned once', () => {
  const notes = createPendingNotes();
  notes.remember('call-1', [NOTE]);
  assert.deepEqual(notes.take('call-1'), [NOTE]);
  assert.equal(notes.take('call-1'), undefined);
});

test('remember copies the supplied entries', () => {
  const notes = createPendingNotes();
  const entries = [NOTE];
  notes.remember('call-1', entries);
  entries.push({ target: 'other.ts', notes: [] });
  assert.deepEqual(notes.take('call-1'), [NOTE]);
});

test('clear removes every pending call', () => {
  const notes = createPendingNotes();
  notes.remember('call-1', [NOTE]);
  notes.remember('call-2', [NOTE]);
  notes.clear();
  assert.equal(notes.take('call-1'), undefined);
  assert.equal(notes.take('call-2'), undefined);
});
