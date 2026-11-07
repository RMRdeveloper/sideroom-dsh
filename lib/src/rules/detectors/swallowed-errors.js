import { blockBody, isBlank, isLineComment, } from './lines.js';
const PYTHON_SWALLOW = /^(?:pass|continue|return\s+None)\s*$/;
function pythonFindings(lines) {
    const findings = [];
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (!/^except\b.*:\s*(?:#.*)?$/.test(trimmed)) {
            continue;
        }
        const inline = trimmed.replace(/^except\b.*?:\s*/, '').trim();
        if (inline !== '') {
            if (PYTHON_SWALLOW.test(inline)) {
                findings.push({ rule: 'swallowed-errors', line: trimmed });
            }
            continue;
        }
        const body = blockBody(lines, index + 1);
        if (body.length === 0
            || body.every((entry) => PYTHON_SWALLOW.test(entry))) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
        }
    }
    return findings;
}
function goFindings(lines) {
    const findings = [];
    for (const source of lines) {
        const trimmed = source.trim();
        if (/^if\s+err\s*!=\s*nil\s*\{\s*\}\s*$/.test(trimmed)) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
        }
    }
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (!/^if\s+err\s*!=\s*nil\s*\{\s*$/.test(trimmed)) {
            continue;
        }
        const body = blockBody(lines, index + 1);
        if (body.length > 0 && body.every((entry) => entry === '_ = err')) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
        }
    }
    return findings;
}
function rustFindings(lines) {
    const findings = [];
    for (const source of lines) {
        const trimmed = source.trim();
        if (/^let\s+_\s*=/.test(trimmed)
            || /^\S.*\.ok\(\)\s*;?\s*$/.test(trimmed)) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
        }
    }
    return findings;
}
const EMPTY_OR_DEFAULT = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:return\s+(?:null|undefined|false|0|'')?\s*;?\s*)?\}\s*;?\s*$/;
const OPENS_BLOCK = /catch\s*(?:\([^)]*\))?\s*\{\s*$/;
const PROMISE_SWALLOW = /\.catch\(\s*(?:\(\s*\w*\s*\)\s*=>|\(\s*\)\s*=>)\s*(?:\{\s*\}|null|undefined|false)\s*\)/;
const RETURN_SWALLOW = /^return\s+(?:null|undefined|false|void|0)\s*;?$/;
const ONLY_LOG_OUTPUT = /^console\.(?:log|debug|info|warn|error)\(.*\);?$/;
function braceFindings(lines) {
    const findings = [];
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (isBlank(trimmed) || isLineComment(trimmed)) {
            continue;
        }
        if (EMPTY_OR_DEFAULT.test(trimmed) || PROMISE_SWALLOW.test(trimmed)) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
            continue;
        }
        if (!OPENS_BLOCK.test(trimmed)) {
            continue;
        }
        const body = blockBody(lines, index + 1);
        if (body.length === 0) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
            continue;
        }
        if (body.every((entry) => RETURN_SWALLOW.test(entry))) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
            continue;
        }
        if (body.every((entry) => ONLY_LOG_OUTPUT.test(entry))) {
            findings.push({ rule: 'swallowed-errors', line: trimmed });
        }
    }
    return findings;
}
export function detectSwallowedErrors({ lines, language, }) {
    if (language === 'python') {
        return pythonFindings(lines);
    }
    if (language === 'go') {
        return goFindings(lines);
    }
    if (language === 'rust') {
        return rustFindings(lines);
    }
    return braceFindings(lines);
}
