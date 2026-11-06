import { RULES } from './types.js';
function updateBreakers({ findings, config, breaker, agentId, }) {
    const blocking = new Set(config.blocking);
    const noted = new Set(config.notes);
    for (const rule of Object.keys(RULES)) {
        const hit = findings.some((finding) => finding.rule === rule);
        const counter = breaker(agentId, rule);
        if (hit) {
            counter.clean = 0;
            continue;
        }
        if (blocking.has(rule) || noted.has(rule)) {
            counter.clean += 1;
            if (counter.clean >= config.resetAfter) {
                counter.blocks = 0;
                counter.clean = 0;
            }
        }
    }
}
export function evaluate(input) {
    const blocks = [];
    const notes = [];
    const blocking = new Set(input.config.blocking);
    const noted = new Set(input.config.notes);
    updateBreakers(input);
    for (const finding of input.findings) {
        const counter = input.breaker(input.agentId, finding.rule);
        if (blocking.has(finding.rule)) {
            counter.blocks += 1;
            if (counter.blocks > input.config.degradeAfter) {
                notes.push({ ...finding, degraded: true });
                continue;
            }
            blocks.push(finding);
            continue;
        }
        if (noted.has(finding.rule)) {
            notes.push(finding);
        }
    }
    return { blocks, notes };
}
