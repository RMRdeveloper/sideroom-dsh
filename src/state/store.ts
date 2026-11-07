export interface RuleCounter {
  blocks: number;
  clean: number;
}

export interface PendingReview {
  cwd: string;
}

export interface RunRecord {
  turn: number;
  loaded: Set<string>;
  reviewArmed: boolean;
  reviewSent: boolean;
  reviewCwd: string | null;
  breakers: Map<string, RuleCounter>;
}

export interface RunStore {
  beginTurn(agentId: string, turn: number): void;
  markLoaded(agentId: string, slot: string): void;
  isLoaded(agentId: string, slot: string): boolean;
  armReview(agentId: string, cwd: string): void;
  pendingReview(agentId: string): PendingReview | null;
  markReviewSent(agentId: string): void;
  breaker(agentId: string, rule: string): RuleCounter;
}

export function createRunStore(): RunStore {
  const runs = new Map<string, RunRecord>();

  function runFor(agentId: string): RunRecord {
    let run = runs.get(agentId);
    if (run === undefined) {
      run = {
        turn: -1,
        loaded: new Set(),
        reviewArmed: false,
        reviewSent: false,
        reviewCwd: null,
        breakers: new Map(),
      };
      runs.set(agentId, run);
    }
    return run;
  }

  function beginTurn(agentId: string, turn: number): void {
    const run = runFor(agentId);
    if (run.turn === turn) {
      return;
    }
    run.turn = turn;
    run.loaded.clear();
    run.reviewArmed = false;
    run.reviewSent = false;
    run.reviewCwd = null;
    run.breakers.clear();
  }

  function markLoaded(agentId: string, slot: string): void {
    runFor(agentId).loaded.add(slot);
  }

  function isLoaded(agentId: string, slot: string): boolean {
    return runFor(agentId).loaded.has(slot);
  }

  function armReview(agentId: string, cwd: string): void {
    const run = runFor(agentId);
    if (run.reviewSent) {
      return;
    }
    run.reviewArmed = true;
    run.reviewCwd = cwd;
  }

  function pendingReview(agentId: string): PendingReview | null {
    const run = runFor(agentId);
    if (!run.reviewArmed || run.reviewSent || run.reviewCwd === null) {
      return null;
    }
    return { cwd: run.reviewCwd };
  }

  function markReviewSent(agentId: string): void {
    const run = runFor(agentId);
    run.reviewArmed = false;
    run.reviewSent = true;
    run.reviewCwd = null;
  }

  function breaker(agentId: string, rule: string): RuleCounter {
    const run = runFor(agentId);
    let counter = run.breakers.get(rule);
    if (counter === undefined) {
      counter = { blocks: 0, clean: 0 };
      run.breakers.set(rule, counter);
    }
    return counter;
  }

  return {
    beginTurn,
    markLoaded,
    isLoaded,
    armReview,
    pendingReview,
    markReviewSent,
    breaker,
  };
}
