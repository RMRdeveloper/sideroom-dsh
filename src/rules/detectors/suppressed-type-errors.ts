import type { CheckContext, Finding } from '@/rules/types.js';
import { maskCode } from '@/rules/detectors/code-mask.js';

const SUPPRESSED = /(?:\/\/|\/\*)\s*@ts-(?:ignore|nocheck)\b/;

export function detectSuppressedTypeErrors({
  lines,
  language,
}: CheckContext): Finding[] {
  if (language !== 'typescript') {
    return [];
  }
  const masked = maskCode(lines, { keepComments: true });
  const findings: Finding[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (SUPPRESSED.test(masked[index] ?? '')) {
      findings.push({
        rule: 'suppressed-type-errors',
        line: lines[index].trim(),
      });
    }
  }
  return findings;
}
