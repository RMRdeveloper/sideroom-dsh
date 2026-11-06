import { detectBracedConditionals } from './detectors/braced-conditionals.js'
import { detectClearNames } from './detectors/clear-names.js'
import {
  detectCommentedCode,
  detectStaleComments,
} from './detectors/comments.js'
import { detectDebugArtifacts } from './detectors/debug-artifacts.js'
import { detectSwallowedErrors } from './detectors/swallowed-errors.js'
import type { CheckContext, Finding } from './types.js'

type Detector = (context: CheckContext) => Finding[]

const DETECTORS: readonly Detector[] = [
  detectBracedConditionals,
  detectSwallowedErrors,
  detectClearNames,
  detectStaleComments,
  detectCommentedCode,
  detectDebugArtifacts,
]

export function collectFindings(context: CheckContext): Finding[] {
  const findings: Finding[] = []
  for (const detector of DETECTORS) {
    findings.push(...detector(context))
  }
  return findings
}

export { evaluate } from './policy.js'
export type { Breaker, EvaluateInput, Evaluation } from './policy.js'
export { blockedReason, describeFinding, notesText } from './report.js'
export { RULES, RULE_IDS } from './types.js'
export type {
  CheckContext,
  Finding,
  RuleId,
  RuleMeta,
  RulePolicy,
} from './types.js'
