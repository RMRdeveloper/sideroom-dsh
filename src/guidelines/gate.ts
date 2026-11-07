import type { GuidelinesSettings } from '@/config.js';
import { GENERAL_LANGUAGE } from '@/languages.js';
import type { RunStore } from '@/state/store.js';
import { CONTRACT_SLOT } from '@/guidelines/slots.js';

export interface GateTarget {
  target: string;
  language: string;
}

export interface GateInput {
  store: RunStore;
  settings: GuidelinesSettings;
  agentId: string;
  toolName: string;
  targets: readonly GateTarget[];
}

export interface Denial {
  kind: 'deny';
  reason: string;
}

export function coversLanguage(
  settings: GuidelinesSettings,
  language: string,
): boolean {
  return language !== GENERAL_LANGUAGE || settings.gateUnrecognized;
}

function missingTargets({
  store,
  settings,
  agentId,
  targets,
}: Omit<GateInput, 'toolName'>): GateTarget[] {
  const seen = new Set<string>();
  const missing: GateTarget[] = [];
  for (const target of targets) {
    if (!coversLanguage(settings, target.language)) {
      continue;
    }
    const key = `${target.target}\u0000${target.language}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (
      !store.isLoaded(agentId, CONTRACT_SLOT)
      || !store.isLoaded(agentId, target.language)
    ) {
      missing.push(target);
    }
  }
  return missing;
}

function singleDenial(toolName: string, target: GateTarget): Denial {
  return {
    kind: 'deny',
    reason: `Sideroom gate: the coding guidelines are not loaded for this run, so this mutation is blocked. Call sideroom_guidelines with {"path": ${JSON.stringify(target.target)}} and retry this ${toolName}. The call returns the 20 canonical rules plus the matching language guide.`,
  };
}

function manyDenial(toolName: string, targets: readonly GateTarget[]): Denial {
  const list = targets
    .map((target) => `- ${target.target} (${target.language})`)
    .join('\n');
  return {
    kind: 'deny',
    reason: `Sideroom gate: the coding guidelines are not loaded for this run, so this mutation is blocked.
Call sideroom_guidelines for each target and retry this ${toolName}:
${list}`,
  };
}

export function gateDecision(input: GateInput): Denial | null {
  if (!input.settings.enabled) {
    return null;
  }
  const missing = missingTargets(input);
  if (missing.length === 0) {
    return null;
  }
  if (missing.length === 1) {
    return singleDenial(input.toolName, missing[0]);
  }
  return manyDenial(input.toolName, missing);
}
