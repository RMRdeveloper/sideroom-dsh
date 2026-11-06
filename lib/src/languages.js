export const GENERAL_LANGUAGE = 'general';
const BY_EXTENSION = {
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
const GUIDE_FILE = {
    typescript: 'typescript',
    javascript: 'javascript',
    python: 'python',
    go: 'go',
    rust: 'rust',
    java: 'java',
    php: 'php-laravel',
};
const BRACE_LANGUAGES = new Set([
    'typescript',
    'javascript',
    'java',
    'php',
]);
export function languageOfPath(path) {
    if (typeof path !== 'string') {
        return GENERAL_LANGUAGE;
    }
    const match = /\.([A-Za-z0-9]+)$/.exec(path.trim());
    if (match === null) {
        return GENERAL_LANGUAGE;
    }
    return BY_EXTENSION[match[1].toLowerCase()] ?? GENERAL_LANGUAGE;
}
export function guideFileFor(language) {
    return GUIDE_FILE[language] ?? null;
}
export function usesBraces(language) {
    return BRACE_LANGUAGES.has(language);
}
