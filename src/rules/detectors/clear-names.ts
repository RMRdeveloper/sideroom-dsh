import type { CheckContext, Finding } from '@/rules/types.js';
import { isBlank, isLineComment } from '@/rules/detectors/lines.js';

const VAGUE_NAMES: ReadonlySet<string> = new Set([
  'data',
  'info',
  'temp',
  'tmp',
  'result',
  'obj',
  'val',
  'x',
  'arr',
]);

const DECLARATION
  = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/;
const FUNCTION_HEADER
  = /^(?:export\s+)?(?:async\s+)?function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/;

function parameterNames(header: string): string[] {
  return header
    .split(',')
    .map((parameter) => parameter.split(/[:=]/)[0].trim().replace(/^\*+/, ''))
    .filter((name) => name !== '');
}

export function detectClearNames({ lines }: CheckContext): Finding[] {
  const findings: Finding[] = [];
  for (const source of lines) {
    const trimmed = source.trim();
    if (isBlank(trimmed) || isLineComment(trimmed)) {
      continue;
    }
    const declared = DECLARATION.exec(trimmed);
    if (declared !== null && VAGUE_NAMES.has(declared[1])) {
      findings.push({ rule: 'clear-names', line: trimmed });
      continue;
    }
    const parameters = FUNCTION_HEADER.exec(trimmed);
    if (parameters === null) {
      continue;
    }
    if (parameterNames(parameters[1]).some((name) => VAGUE_NAMES.has(name))) {
      findings.push({ rule: 'clear-names', line: trimmed });
    }
  }
  return findings;
}
