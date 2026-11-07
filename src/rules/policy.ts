import type { RuleCounter } from '@/state/store.js';
import { RULES, type Finding, type RuleId, type RulePolicy } from '@/rules/types.js';

export type Breaker = (agentId: string, rule: string) => RuleCounter;

export interface EvaluateInput {
  findings: Finding[];
  config: RulePolicy;
  breaker: Breaker;
  agentId: string;
}

export interface Evaluation {
  blocks: Finding[];
  notes: Finding[];
}

function updateBreakers({
  findings,
  config,
  breaker,
  agentId,
}: EvaluateInput): void {
  const blocking = new Set(config.blocking);
  const noted = new Set(config.notes);
  for (const rule of Object.keys(RULES) as RuleId[]) {
    const hit = findings.some((finding) => finding.rule === rule);
    const counter = breaker(agentId, rule);
    if (hit) {
      counter.clean = 0;
      continue;
    }
    if (blocking.has(rule) || noted.has(rule)) {
      counter.clean += 1;
      if (counter.clean >= config.resetAfter) {
        counter.blocks = 0;
        counter.clean = 0;
      }
    }
  }
}

export function evaluate(input: EvaluateInput): Evaluation {
  const blocks: Finding[] = [];
  const notes: Finding[] = [];
  const blocking = new Set(input.config.blocking);
  const noted = new Set(input.config.notes);

  updateBreakers(input);

  for (const finding of input.findings) {
    const counter = input.breaker(input.agentId, finding.rule);
    if (blocking.has(finding.rule)) {
      counter.blocks += 1;
      if (counter.blocks > input.config.degradeAfter) {
        notes.push({ ...finding, degraded: true });
        continue;
      }
      blocks.push(finding);
      continue;
    }
    if (noted.has(finding.rule)) {
      notes.push(finding);
    }
  }

  return { blocks, notes };
}
