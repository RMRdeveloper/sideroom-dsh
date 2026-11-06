import type { Finding } from '../rules/types.js'

export interface PendingNote {
  notes: Finding[]
  target: string
}

export interface PendingNotes {
  remember(callId: string, note: PendingNote): void
  take(callId: string): PendingNote | undefined
  clear(): void
}

export function createPendingNotes(): PendingNotes {
  const entries = new Map<string, PendingNote>()

  function remember(callId: string, note: PendingNote): void {
    entries.set(callId, note)
  }

  function take(callId: string): PendingNote | undefined {
    const note = entries.get(callId)
    entries.delete(callId)
    return note
  }

  function clear(): void {
    entries.clear()
  }

  return { remember, take, clear }
}
