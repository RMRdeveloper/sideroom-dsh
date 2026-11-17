import { formatAdvisoryNotes, } from './model.js';
import { GATE_RULE_ID, JEV_PLAN_GATE_QUESTION, JEV_PLAN_RULES, } from './questions.js';
const MAX_PLAN_FILES = 4;
const PLAN_PATH_PATTERN = /\b((?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|php))\b/gu;
const EVIDENCE_RULES = new Set([
    'plan-duplicates-existing',
    'plan-abstraction-justified',
    'plan-contradicts-evidence',
]);
export function buildPlanRequestBody({ plan, files, model, }) {
    const state = {
        plan: { text: plan, mentionedFiles: filePathsIn(plan) },
        files: files.map((file) => ({ path: file.path, body: file.body })),
    };
    const questions = {
        [GATE_RULE_ID]: JEV_PLAN_GATE_QUESTION.question,
    };
    for (const rule of JEV_PLAN_RULES) {
        if (EVIDENCE_RULES.has(rule.id) && files.length === 0) {
            continue;
        }
        questions[rule.id] = rule.question;
    }
    return { model, state, questions };
}
export function filePathsIn(plan) {
    const paths = new Set();
    for (const match of plan.matchAll(PLAN_PATH_PATTERN)) {
        const candidate = match[1];
        if (candidate === undefined) {
            continue;
        }
        paths.add(candidate);
        if (paths.size >= MAX_PLAN_FILES) {
            break;
        }
    }
    return [...paths];
}
export function formatPlanNotes(notes) {
    return formatAdvisoryNotes({
        title: 'plan review',
        notes,
        footer: 'Jev is a classifier over the plan, not a reviewer. Verify each point against the code the plan touches and the loaded guide; change the plan only if the evidence confirms it.',
    });
}
