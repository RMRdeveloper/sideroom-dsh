import type { Finding } from '@/rules/types.js';

export interface PendingNote {
  notes: Finding[];
  target: string;
}

export interface PendingNotes {
  remember(callId: string, notes: readonly PendingNote[]): void;
  take(callId: string): PendingNote[] | undefined;
  clear(): void;
}

export function createPendingNotes(): PendingNotes {
  const entries = new Map<string, PendingNote[]>();

  function remember(callId: string, notes: readonly PendingNote[]): void {
    entries.set(callId, [...notes]);
  }

  function take(callId: string): PendingNote[] | undefined {
    const entry = entries.get(callId);
    entries.delete(callId);
    return entry;
  }

  function clear(): void {
    entries.clear();
  }

  return { remember, take, clear };
}
