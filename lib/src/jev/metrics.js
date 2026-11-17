export const CALIBRATION_MIN_SAMPLES = 10;
export const CALIBRATION_ACCEPTANCE_FLOOR = 0.2;
const ACCEPTANCE_WINDOW_TURNS = 1;
export function createJevMetrics() {
    const emitted = new Map();
    const accepted = new Map();
    let pending = [];
    function delivered(notes, turn) {
        for (const note of notes) {
            emitted.set(note.ruleId, (emitted.get(note.ruleId) ?? 0) + 1);
            pending.push({ path: note.path, ruleId: note.ruleId, turn });
        }
    }
    function mutation(path, turn) {
        const kept = [];
        for (const entry of pending) {
            if (entry.path === path && turn > entry.turn) {
                accepted.set(entry.ruleId, (accepted.get(entry.ruleId) ?? 0) + 1);
                continue;
            }
            kept.push(entry);
        }
        pending = kept;
    }
    function settle(turn) {
        pending = pending.filter((entry) => entry.turn >= turn - ACCEPTANCE_WINDOW_TURNS);
    }
    function muted(minSamples = CALIBRATION_MIN_SAMPLES, floor = CALIBRATION_ACCEPTANCE_FLOOR) {
        const rules = new Set();
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
    function snapshot() {
        const rules = {};
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
