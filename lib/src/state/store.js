export function createRunStore() {
    const runs = new Map();
    function runFor(agentId) {
        let run = runs.get(agentId);
        if (run === undefined) {
            run = {
                turn: -1,
                loaded: new Set(),
                reviewSent: false,
                breakers: new Map(),
            };
            runs.set(agentId, run);
        }
        return run;
    }
    function beginTurn(agentId, turn) {
        const run = runFor(agentId);
        if (run.turn === turn) {
            return;
        }
        run.turn = turn;
        run.loaded.clear();
        run.reviewSent = false;
        run.breakers.clear();
    }
    function markLoaded(agentId, slot) {
        runFor(agentId).loaded.add(slot);
    }
    function isLoaded(agentId, slot) {
        return runFor(agentId).loaded.has(slot);
    }
    function takeReview(agentId) {
        const run = runFor(agentId);
        if (run.reviewSent) {
            return false;
        }
        run.reviewSent = true;
        return true;
    }
    function breaker(agentId, rule) {
        const run = runFor(agentId);
        let counter = run.breakers.get(rule);
        if (counter === undefined) {
            counter = { blocks: 0, clean: 0 };
            run.breakers.set(rule, counter);
        }
        return counter;
    }
    return { beginTurn, markLoaded, isLoaded, takeReview, breaker };
}
