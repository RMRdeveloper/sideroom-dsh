import { TEST_PATH_PATTERN } from './patterns.js';
import { GENERAL_LANGUAGE, languageOfPath } from '../languages.js';
import { GATE_RULE_ID, JEV_GATE_QUESTION, JEV_RULES, } from './questions.js';
export { JEV_GATE_QUESTION, JEV_RULES } from './questions.js';
export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = 'jev-latest';
export const JEV_CUTOFF = 0.8;
export const JEV_GATE_CUTOFF = 0.6;
export const MAX_STATE_BYTES = 32_000;
export const MAX_REQUEST_BYTES = 64_000;
export function isTestPath(path) {
    return TEST_PATH_PATTERN.test(path);
}
export function isReviewablePath(path) {
    return languageOfPath(path) !== GENERAL_LANGUAGE;
}
export function buildFileState({ path, body, kind, addedLines, relatedFiles = [], partial = false, }) {
    return {
        file: { path, language: languageOfPath(path), body },
        change: { kind, addedLines: [...addedLines] },
        context: { files: [...relatedFiles], partial },
    };
}
export function buildRequestBody(state, model) {
    const questions = {
        [GATE_RULE_ID]: JEV_GATE_QUESTION.question,
    };
    const hasImportedFile = state.context.files.some((related) => related.relation === 'imported');
    const hasConsumer = state.context.files.some((related) => related.relation === 'consumer' && !isTestPath(related.path));
    const hasTest = isTestPath(state.file.path)
        || state.context.files.some((related) => isTestPath(related.path));
    const hasProduction = !isTestPath(state.file.path)
        || state.context.files.some((related) => !isTestPath(related.path));
    const addedText = state.change.addedLines.join('\n');
    for (const rule of JEV_RULES) {
        if (rule.id === 'dependency-direction' && !hasImportedFile) {
            continue;
        }
        if (rule.id === 'comments' && !/(?:\/\/|\/\*|#)/u.test(addedText)) {
            continue;
        }
        if (rule.id === 'contract-compatibility' && !hasConsumer) {
            continue;
        }
        if (rule.id === 'test-quality' && (!hasTest || !hasProduction)) {
            continue;
        }
        questions[rule.id] = rule.question;
    }
    return { model, state, questions };
}
export function requestFitsBudget(request) {
    const longestQuestion = Object.values(request.questions).reduce((longest, question) => Math.max(longest, Buffer.byteLength(JSON.stringify(question))), 0);
    return (Buffer.byteLength(JSON.stringify(request.state)) + longestQuestion
        <= MAX_STATE_BYTES
        && Buffer.byteLength(JSON.stringify(request)) <= MAX_REQUEST_BYTES);
}
export function parseEnvelope(text) {
    const payload = parseJsonObject(text);
    if (payload === undefined) {
        return undefined;
    }
    const model = typeof payload.model === 'string' ? payload.model : undefined;
    return { model, answers: readAnswers(payload.answers) };
}
export function readGate(envelope) {
    const gate = envelope.answers?.[GATE_RULE_ID];
    if (gate === undefined || !isProbability(gate.noul)) {
        return undefined;
    }
    return gate.noul;
}
export function readFindings({ envelope, asked, cutoff, gate, }) {
    const answers = envelope.answers;
    const gateProbability = readGate(envelope);
    if (answers === undefined || gateProbability === undefined) {
        return [];
    }
    if (gateProbability < gate) {
        return [];
    }
    const findings = [];
    for (const ruleId of asked) {
        if (ruleId === GATE_RULE_ID) {
            continue;
        }
        const answer = answers[ruleId];
        if (answer === undefined || !isProbability(answer.noul)) {
            continue;
        }
        if (answer.noul < cutoff) {
            continue;
        }
        findings.push({ ruleId, probability: answer.noul });
    }
    return findings.sort((left, right) => right.probability - left.probability
        || compareText(left.ruleId, right.ruleId));
}
export function findingKey(path, ruleId) {
    return `${path}#${ruleId}`;
}
export function formatAdvisoryNotes({ title, notes, footer, includePath = false, }) {
    const model = notes.find((note) => note.model !== undefined)?.model;
    const header = model === undefined
        ? `Sideroom Jev ${title} (advisory, never a gate):`
        : `Sideroom Jev ${title} (model ${model}, advisory, never a gate):`;
    const lines = notes.map((note) => includePath
        ? `- \`${note.path}\` [${note.ruleId}] p=${note.probability.toFixed(2)}`
        : `- [${note.ruleId}] p=${note.probability.toFixed(2)}`);
    return `${header}
${lines.join('\n')}

${footer}`;
}
export function formatJevNotes(notes) {
    return formatAdvisoryNotes({
        title: 'review',
        notes,
        includePath: true,
        footer: 'Jev is a classifier over the changed code, not a reviewer. Verify each point against the loaded guide and the changed file; change the code only if the evidence confirms it. Missing context is not proof of a problem.',
    });
}
export function formatFindingNote({ path, finding, model, }) {
    return {
        path,
        ruleId: finding.ruleId,
        probability: finding.probability,
        model,
    };
}
function isProbability(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
function compareText(left, right) {
    if (left < right) {
        return -1;
    }
    if (left > right) {
        return 1;
    }
    return 0;
}
function parseJsonObject(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return undefined;
        }
        throw error;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return undefined;
    }
    return parsed;
}
function readAnswers(value) {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const answers = {};
    for (const [id, entry] of Object.entries(value)) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const { noul } = entry;
        if (typeof noul === 'number') {
            answers[id] = { noul };
        }
    }
    return answers;
}
