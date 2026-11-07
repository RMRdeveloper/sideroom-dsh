import type { CheckContext, Finding } from '@/rules/types.js';
import { maskCode } from '@/rules/detectors/code-mask.js';

const ANY_PATTERNS: readonly RegExp[] = [
  /:\s*[^;=]*\bany\b/,
  /[=<,]\s*any\s*[,>=]/,
  /\bas\s+any\b/,
  /\bsatisfies\s+any\b/,
  /\bkeyof\s+any\b/,
  /\bany\s*\[\s*\]/,
  /\btype\s+\w+(?:\s*<[^;=]*>)?\s*=\s*[^;]*\bany\b/,
];

export function detectExplicitAny({
  lines,
  language,
}: CheckContext): Finding[] {
  if (language !== 'typescript') {
    return [];
  }
  const masked = maskCode(lines, { keepComments: false });
  const findings: Finding[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const code = masked[index] ?? '';
    if (ANY_PATTERNS.some((pattern) => pattern.test(code))) {
      findings.push({ rule: 'explicit-any', line: lines[index].trim() });
    }
  }
  return findings;
}
