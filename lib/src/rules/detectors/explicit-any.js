import { maskCode } from './code-mask.js';
const ANY_PATTERNS = [
    /:\s*[^;=]*\bany\b/,
    /[=<,]\s*any\s*[,>=]/,
    /\bas\s+any\b/,
    /\bsatisfies\s+any\b/,
    /\bkeyof\s+any\b/,
    /\bany\s*\[\s*\]/,
    /\btype\s+\w+(?:\s*<[^;=]*>)?\s*=\s*[^;]*\bany\b/,
];
export function detectExplicitAny({ lines, language, }) {
    if (language !== 'typescript') {
        return [];
    }
    const masked = maskCode(lines, { keepComments: false });
    const findings = [];
    for (let index = 0; index < lines.length; index += 1) {
        const code = masked[index] ?? '';
        if (ANY_PATTERNS.some((pattern) => pattern.test(code))) {
            findings.push({ rule: 'explicit-any', line: lines[index].trim() });
        }
    }
    return findings;
}
