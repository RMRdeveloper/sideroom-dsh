import { detectBracedConditionals } from './detectors/braced-conditionals.js';
import { detectClearNames } from './detectors/clear-names.js';
import { detectCommentedCode, detectStaleComments, } from './detectors/comments.js';
import { detectDebugArtifacts } from './detectors/debug-artifacts.js';
import { detectExplicitAny } from './detectors/explicit-any.js';
import { detectSuppressedTypeErrors } from './detectors/suppressed-type-errors.js';
import { detectSwallowedErrors } from './detectors/swallowed-errors.js';
const DETECTORS = [
    detectBracedConditionals,
    detectExplicitAny,
    detectSwallowedErrors,
    detectClearNames,
    detectStaleComments,
    detectCommentedCode,
    detectDebugArtifacts,
    detectSuppressedTypeErrors,
];
export function collectFindings(context) {
    const findings = [];
    for (const detector of DETECTORS) {
        findings.push(...detector(context));
    }
    return findings;
}
export { evaluate } from './policy.js';
export { blockedReason, describeFinding, notesText } from './report.js';
export { RULES, RULE_IDS } from './types.js';
