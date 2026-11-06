const STALE_MARKER = /(?:\/\/|#|\/\*)\s*(?:TODO|FIXME|XXX|HACK)\b/i;
const COMMENT_PREFIX = /^(?:\/\/|#)\s*(.*)$/;
const CODE_DECLARATION = /^(?:const|let|var|import|export|function|class|def|async\s+function)\s+[A-Za-z_$]/;
const CODE_STATEMENT = /^(?:if|for|while|return|throw|await|try|catch)\b/;
export function detectStaleComments({ lines }) {
    const findings = [];
    for (const source of lines) {
        if (STALE_MARKER.test(source)) {
            findings.push({ rule: 'stale-comments', line: source.trim() });
        }
    }
    return findings;
}
export function detectCommentedCode({ lines }) {
    const findings = [];
    for (const source of lines) {
        const trimmed = source.trim();
        const match = COMMENT_PREFIX.exec(trimmed);
        if (match === null) {
            continue;
        }
        const body = match[1].trim();
        if (body === '') {
            continue;
        }
        const declaration = CODE_DECLARATION.test(body);
        const statement = CODE_STATEMENT.test(body) && /[;{)]\s*$/.test(body);
        if (declaration || statement) {
            findings.push({ rule: 'commented-code', line: trimmed });
        }
    }
    return findings;
}
