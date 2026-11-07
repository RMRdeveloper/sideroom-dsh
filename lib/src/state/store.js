export function createRunStore() {
    const runs = new Map();
    function runFor(agentId) {
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
    function beginTurn(agentId, turn) {
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
    function markLoaded(agentId, slot) {
        runFor(agentId).loaded.add(slot);
    }
    function isLoaded(agentId, slot) {
        return runFor(agentId).loaded.has(slot);
    }
    function armReview(agentId, cwd) {
        const run = runFor(agentId);
        if (run.reviewSent) {
            return;
        }
        run.reviewArmed = true;
        run.reviewCwd = cwd;
    }
    function pendingReview(agentId) {
        const run = runFor(agentId);
        if (!run.reviewArmed || run.reviewSent || run.reviewCwd === null) {
            return null;
        }
        return { cwd: run.reviewCwd };
    }
    function markReviewSent(agentId) {
        const run = runFor(agentId);
        run.reviewArmed = false;
        run.reviewSent = true;
        run.reviewCwd = null;
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
