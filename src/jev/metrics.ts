import type { JevNote } from '@/jev/model.js';

export const CALIBRATION_MIN_SAMPLES = 10;
export const CALIBRATION_ACCEPTANCE_FLOOR = 0.2;
const ACCEPTANCE_WINDOW_TURNS = 1;

export interface RuleMetric {
  emitted: number;
  accepted: number;
  rate: number;
}

export interface JevMetricsSnapshot {
  rules: Record<string, RuleMetric>;
}

interface PendingNote {
  path: string;
  ruleId: string;
  turn: number;
}

export interface JevMetrics {
  delivered(notes: readonly JevNote[], turn: number): void;
  mutation(path: string, turn: number): void;
  settle(turn: number): void;
  muted(
    minSamples?: number,
    floor?: number,
  ): ReadonlySet<string>;
  snapshot(): JevMetricsSnapshot;
}

export function createJevMetrics(): JevMetrics {
  const emitted = new Map<string, number>();
  const accepted = new Map<string, number>();
  let pending: PendingNote[] = [];

  function delivered(notes: readonly JevNote[], turn: number): void {
    for (const note of notes) {
      emitted.set(note.ruleId, (emitted.get(note.ruleId) ?? 0) + 1);
      pending.push({ path: note.path, ruleId: note.ruleId, turn });
    }
  }

  function mutation(path: string, turn: number): void {
    const kept: PendingNote[] = [];
    for (const entry of pending) {
      if (entry.path === path && turn > entry.turn) {
        accepted.set(entry.ruleId, (accepted.get(entry.ruleId) ?? 0) + 1);
        continue;
      }
      kept.push(entry);
    }
    pending = kept;
  }

  function settle(turn: number): void {
    pending = pending.filter(
      (entry) => entry.turn >= turn - ACCEPTANCE_WINDOW_TURNS,
    );
  }

  function muted(
    minSamples: number = CALIBRATION_MIN_SAMPLES,
    floor: number = CALIBRATION_ACCEPTANCE_FLOOR,
  ): ReadonlySet<string> {
    const rules = new Set<string>();
    for (const [ruleId, total] of emitted) {
      if (total < minSamples) {
        continue;
      }
      const rate = (accepted.get(ruleId) ?? 0) / total;
      if (rate < floor) {
        rules.add(ruleId);
      }
    }
    return rules;
  }

  function snapshot(): JevMetricsSnapshot {
    const rules: Record<string, RuleMetric> = {};
    for (const [ruleId, total] of emitted) {
      const hits = accepted.get(ruleId) ?? 0;
      rules[ruleId] = {
        emitted: total,
        accepted: hits,
        rate: total === 0 ? 0 : hits / total,
      };
    }
    return { rules };
  }

  return { delivered, mutation, settle, muted, snapshot };
}
