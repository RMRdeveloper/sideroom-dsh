import { RULES } from './types.js';
const LABELS = {
    blocked: 'blocked',
    note: 'note',
    degraded: 'note (rule keeps firing)',
};
export function describeFinding(finding, label = 'note') {
    const meta = RULES[finding.rule];
    return `- [${LABELS[label]}] rule ${meta.number} ${meta.name}: ${meta.fix}. Line: \`${finding.line}\``;
}
export function blockedReason({ toolName, filePath, blocks, }) {
    const lines = blocks.map((finding) => describeFinding(finding, 'blocked'));
    const plural = blocks.length === 1 ? '' : 's';
    return [
        `Sideroom blocked this ${toolName} of ${filePath}: the lines you added break ${blocks.length} guideline rule${plural}.`,
        ...lines,
        'Fix those lines and retry the same call. A rule that keeps firing degrades to a note instead of blocking again.',
    ].join('\n');
}
export function notesText({ notes, filePath }) {
    return [
        `Sideroom notes for ${filePath}:`,
        ...notes.map((finding) => describeFinding(finding, finding.degraded === true ? 'degraded' : 'note')),
    ].join('\n');
}
