import { formatAdvisoryNotes, } from './model.js';
import { GATE_RULE_ID, JEV_QUESTIONNAIRE_GATE_QUESTION, JEV_QUESTIONNAIRE_RULES, JEV_TODO_GATE_QUESTION, JEV_TODO_RULES, } from './questions.js';
const RECOMMENDED_MARKER = '(Recommended)';
export function readQuestionnaire(argumentsValue) {
    if (typeof argumentsValue !== 'object' || argumentsValue === null) {
        return undefined;
    }
    const raw = argumentsValue.questions;
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const questions = [];
    for (const [index, entry] of raw.entries()) {
        const parsed = parseQuestion(entry, index);
        if (parsed !== undefined) {
            questions.push(parsed);
        }
    }
    return questions.length === 0 ? undefined : questions;
}
export function buildQuestionnaireRequestBody({ questions, model, }) {
    const state = {
        kind: 'questionnaire',
        questions: questions.map((question) => ({
            ...question,
            options: question.options.map((option) => ({ ...option })),
        })),
    };
    const requestQuestions = {
        [GATE_RULE_ID]: JEV_QUESTIONNAIRE_GATE_QUESTION.question,
    };
    const hasOptions = questions.some((question) => question.options.length > 0);
    const hasRecommendation = questions.some((question) => question.options.some((option) => option.recommended));
    for (const rule of JEV_QUESTIONNAIRE_RULES) {
        if (rule.id === 'questionnaire-overlapping-options' && !hasOptions) {
            continue;
        }
        if (rule.id === 'questionnaire-unsupported-recommendation'
            && !hasRecommendation) {
            continue;
        }
        requestQuestions[rule.id] = rule.question;
    }
    return { model, state, questions: requestQuestions };
}
export function formatQuestionnaireNotes(notes) {
    return formatAdvisoryNotes({
        title: 'questionnaire review',
        notes,
        footer: 'Jev is a classifier over the questions, not a reviewer. Reword only what the evidence confirms, and never change an answer the user already gave.',
    });
}
function parseQuestion(value, index) {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const record = value;
    const text = typeof record.question === 'string' ? record.question.trim() : '';
    if (text === '') {
        return undefined;
    }
    const id = typeof record.id === 'string' && record.id.trim() !== ''
        ? record.id.trim()
        : `q${String(index + 1)}`;
    const header = typeof record.header === 'string' && record.header.trim() !== ''
        ? record.header.trim()
        : undefined;
    return {
        id,
        header,
        text,
        options: readOptions(record.options),
        multiSelect: record.multiSelect === true,
    };
}
function readOptions(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const options = [];
    for (const entry of value) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const record = entry;
        const label = typeof record.label === 'string' ? record.label.trim() : '';
        if (label === '') {
            continue;
        }
        options.push({
            label,
            description: typeof record.description === 'string'
                && record.description.trim() !== ''
                ? record.description.trim()
                : undefined,
            recommended: options.length === 0 && label.includes(RECOMMENDED_MARKER),
        });
    }
    return options;
}
export function readTodoList(argumentsValue) {
    if (typeof argumentsValue !== 'object' || argumentsValue === null) {
        return undefined;
    }
    const raw = argumentsValue.todos;
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const items = [];
    for (const entry of raw) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const record = entry;
        if (typeof record.content !== 'string' || typeof record.status !== 'string') {
            continue;
        }
        const content = record.content.trim();
        if (content === '') {
            continue;
        }
        items.push({ content, status: record.status });
    }
    return items.length === 0 ? undefined : items;
}
export function completedItems(previous, next) {
    const completedBefore = new Set(previous
        .filter((item) => item.status === 'completed')
        .map((item) => item.content));
    return next
        .filter((item) => item.status === 'completed' && !completedBefore.has(item.content))
        .map((item) => item.content);
}
export function buildTodoRequestBody({ items, check, model, }) {
    const state = {
        kind: 'todo',
        items: [...items],
        check: { command: check.command, status: check.status },
    };
    const requestQuestions = {
        [GATE_RULE_ID]: JEV_TODO_GATE_QUESTION.question,
    };
    for (const rule of JEV_TODO_RULES) {
        requestQuestions[rule.id] = rule.question;
    }
    return { model, state, questions: requestQuestions };
}
export function formatTodoNotes(notes) {
    return formatAdvisoryNotes({
        title: 'task review',
        notes,
        footer: 'Jev is a classifier over the completion claims, not a reviewer. Verify each point against the visible check evidence; a failed or missing check is not proof of unfinished work, and change the list only if the evidence confirms it.',
    });
}
