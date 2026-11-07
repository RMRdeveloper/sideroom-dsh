import type { CheckContext, Finding } from '@/rules/types.js';

const DEBUG_PATTERNS: Record<string, readonly RegExp[]> = {
  typescript: [/console\.(?:log|debug|trace)\s*\(/, /^\s*debugger\s*;?\s*$/],
  javascript: [/console\.(?:log|debug|trace)\s*\(/, /^\s*debugger\s*;?\s*$/],
  python: [/^\s*print\s*\(/, /\bbreakpoint\(\)/],
  go: [/\bfmt\.Print(?:ln|f)?\(/],
  rust: [/\bdbg!\(/],
  java: [/\bSystem\.out\.print/],
  php: [/\bvar_dump\(|\bdd\(|\bdump\(/],
};

export function detectDebugArtifacts({
  lines,
  language,
}: CheckContext): Finding[] {
  const active = DEBUG_PATTERNS[language] ?? [];
  if (active.length === 0) {
    return [];
  }
  const findings: Finding[] = [];
  for (const source of lines) {
    if (active.some((pattern) => pattern.test(source))) {
      findings.push({ rule: 'debug-artifacts', line: source.trim() });
    }
  }
  return findings;
}
