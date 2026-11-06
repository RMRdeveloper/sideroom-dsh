import { usesBraces } from '../../languages.js';
import { closingParen, isBlank, nextMeaningful } from './lines.js';
function conditionalRemainder(statement) {
    const lead = /^(?:if|for|while)\s*\(/.exec(statement);
    if (lead === null) {
        return null;
    }
    const close = closingParen(statement, lead[0].length - 1);
    if (close === -1) {
        return null;
    }
    return statement.slice(close + 1).trim();
}
function elseRemainder(statement) {
    const match = /^else\b(.*)$/.exec(statement);
    return match === null ? null : match[1].trim();
}
function bodyBindsWithoutBraces(remainder, lines, index) {
    if (remainder.startsWith('{')) {
        return false;
    }
    if (remainder !== '') {
        return true;
    }
    const following = nextMeaningful(lines, index + 1);
    return following !== null && !following.startsWith('{');
}
export function detectBracedConditionals({ lines, language, }) {
    if (!usesBraces(language)) {
        return [];
    }
    const findings = [];
    for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (isBlank(trimmed) ||
            trimmed.startsWith('//') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('/*')) {
            continue;
        }
        const statement = trimmed.replace(/^\}+\s*/, '');
        const conditional = conditionalRemainder(statement);
        if (conditional !== null) {
            if (bodyBindsWithoutBraces(conditional, lines, index)) {
                findings.push({ rule: 'braced-conditionals', line: trimmed });
            }
            continue;
        }
        const alternative = elseRemainder(statement);
        if (alternative === null) {
            continue;
        }
        if (alternative === '') {
            const following = nextMeaningful(lines, index + 1);
            if (following !== null &&
                !following.startsWith('{') &&
                !following.startsWith('if')) {
                findings.push({ rule: 'braced-conditionals', line: trimmed });
            }
            continue;
        }
        if (!alternative.startsWith('{') && !alternative.startsWith('if')) {
            findings.push({ rule: 'braced-conditionals', line: trimmed });
        }
    }
    return findings;
}
