import { detectBracedConditionals } from '@/rules/detectors/braced-conditionals.js';
import { detectClearNames } from '@/rules/detectors/clear-names.js';
import {
  detectCommentedCode,
  detectStaleComments,
} from '@/rules/detectors/comments.js';
import { detectDebugArtifacts } from '@/rules/detectors/debug-artifacts.js';
import { detectExplicitAny } from '@/rules/detectors/explicit-any.js';
import { detectSuppressedTypeErrors } from '@/rules/detectors/suppressed-type-errors.js';
import { detectSwallowedErrors } from '@/rules/detectors/swallowed-errors.js';
import type { CheckContext, Finding } from '@/rules/types.js';

type Detector = (context: CheckContext) => Finding[];

const DETECTORS: readonly Detector[] = [
  detectBracedConditionals,
  detectExplicitAny,
  detectSwallowedErrors,
  detectClearNames,
  detectStaleComments,
  detectCommentedCode,
  detectDebugArtifacts,
  detectSuppressedTypeErrors,
];

export function collectFindings(context: CheckContext): Finding[] {
  const findings: Finding[] = [];
  for (const detector of DETECTORS) {
    findings.push(...detector(context));
  }
  return findings;
}

export { evaluate } from '@/rules/policy.js';
export type { Breaker, EvaluateInput, Evaluation } from '@/rules/policy.js';
export { blockedReason, describeFinding, notesText } from '@/rules/report.js';
export { RULES, RULE_IDS } from '@/rules/types.js';
export type {
  CheckContext,
  Finding,
  RuleId,
  RuleMeta,
  RulePolicy,
} from '@/rules/types.js';
