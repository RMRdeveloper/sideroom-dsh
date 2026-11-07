export const GENERAL_LANGUAGE = 'general';

const BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyi: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  php: 'php',
};

const GUIDE_FILE: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
  php: 'php-laravel',
};

const BRACE_LANGUAGES: ReadonlySet<string> = new Set([
  'typescript',
  'javascript',
  'java',
  'php',
]);

export function languageOfPath(path: string): string {
  if (typeof path !== 'string') {
    return GENERAL_LANGUAGE;
  }
  const match = /\.([A-Za-z0-9]+)$/.exec(path.trim());
  if (match === null) {
    return GENERAL_LANGUAGE;
  }
  return BY_EXTENSION[match[1].toLowerCase()] ?? GENERAL_LANGUAGE;
}

export function guideFileFor(language: string): string | null {
  return GUIDE_FILE[language] ?? null;
}

export function usesBraces(language: string): boolean {
  return BRACE_LANGUAGES.has(language);
}
