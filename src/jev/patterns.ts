export const PROBE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.php',
] as const;

export const PROBE_INDEXES = [
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
] as const;

export const SKIP_DIRECTORIES: ReadonlySet<string> = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

export const SENSITIVE_NAME
  = /secret|credential|password|token|private.?key|api.?key|auth.?key/iu;

export const CODE_COMMENT_PATTERN
  = /\/\*[\s\S]*?\*\/|^[ \t]*\/\/[^\n]*$/gmu;

export const IMPORT_PATTERNS: readonly RegExp[] = [
  /^[ \t]*(?:import|export)\s+(?:\{[^}]*\}|[^\n;]+)\s*from\s*['"](\.[^'"]+)['"]/gmu,
  /^[ \t]*import\s*['"](\.[^'"]+)['"]/gmu,
  /^[ \t]*(?:(?:const|let|var)\s+[\w{} ,]+\s*=\s*)?require\s*\(\s*['"](\.[^'"]+)['"]/gmu,
];

export const PYTHON_IMPORT_PATTERN
  = /^[ \t]*from\s+(\.+)([\w.]*)\s+import\b/gmu;

export const TEST_PATH_PATTERN
  = /(?:^|\/)(?:__tests__|tests?|specs?)\/|(?:[._-](?:test|spec))\.[^/]+$|(?:^|\/)test_[^/]+$|Test\.java$/u;
