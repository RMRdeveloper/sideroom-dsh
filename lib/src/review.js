import { randomUUID } from 'node:crypto';
export function reviewText({ command, green }, jevNotes) {
    const review = `Sideroom review — before calling this done:

1. Re-read every file you changed in this run against the guidelines you loaded. Structural rules
   3, 4, 7, 8, 9, 10 and 20 and architectural rules 11-18 need judgment, not a linter.
2. Run the project formatter, linter, type checks, and tests that apply to the files you touched.
3. Report the exact commands and their outcome. If a check fails, fix it before you finish.`;
    return `${review}${checkLine({ command, green })}${notesBlock(jevNotes)}`;
}
function checkLine({ command, green }) {
    if (green && command !== null) {
        return `

Checks already green this run: \`${command}\`. Reuse that result instead of running it again; rerun only what this edit could have affected.`;
    }
    if (command !== null) {
        return `

Detected check command: \`${command}\`.`;
    }
    return '';
}
function notesBlock(jevNotes) {
    if (jevNotes === undefined || jevNotes === '') {
        return '';
    }
    return `\n\n${jevNotes}`;
}
export function reviewMessage(text) {
    const content = Object.freeze([
        Object.freeze({ type: 'text', text }),
    ]);
    const message = {
        id: randomUUID(),
        role: 'user',
        content,
        source: Object.freeze({ kind: 'sideroom-review' }),
    };
    return Object.freeze(message);
}
