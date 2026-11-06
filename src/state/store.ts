export interface RuleCounter {
  blocks: number
  clean: number
}

export interface RunRecord {
  turn: number
  loaded: Set<string>
  reviewSent: boolean
  breakers: Map<string, RuleCounter>
}

export interface RunStore {
  beginTurn(agentId: string, turn: number): void
  markLoaded(agentId: string, slot: string): void
  isLoaded(agentId: string, slot: string): boolean
  takeReview(agentId: string): boolean
  breaker(agentId: string, rule: string): RuleCounter
}

export function createRunStore(): RunStore {
  const runs = new Map<string, RunRecord>()

  function runFor(agentId: string): RunRecord {
    let run = runs.get(agentId)
    if (run === undefined) {
      run = {
        turn: -1,
        loaded: new Set(),
        reviewSent: false,
        breakers: new Map(),
      }
      runs.set(agentId, run)
    }
    return run
  }

  function beginTurn(agentId: string, turn: number): void {
    const run = runFor(agentId)
    if (run.turn === turn) {
      return
    }
    run.turn = turn
    run.loaded.clear()
    run.reviewSent = false
    run.breakers.clear()
  }

  function markLoaded(agentId: string, slot: string): void {
    runFor(agentId).loaded.add(slot)
  }

  function isLoaded(agentId: string, slot: string): boolean {
    return runFor(agentId).loaded.has(slot)
  }

  function takeReview(agentId: string): boolean {
    const run = runFor(agentId)
    if (run.reviewSent) {
      return false
    }
    run.reviewSent = true
    return true
  }

  function breaker(agentId: string, rule: string): RuleCounter {
    const run = runFor(agentId)
    let counter = run.breakers.get(rule)
    if (counter === undefined) {
      counter = { blocks: 0, clean: 0 }
      run.breakers.set(rule, counter)
    }
    return counter
  }

  return { beginTurn, markLoaded, isLoaded, takeReview, breaker }
}
