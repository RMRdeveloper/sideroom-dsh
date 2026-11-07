import type { GuidelinesSettings, RulesSettings } from '@/config.js';
import { isMutationTool } from '@/dsh/tool-names.js';
import { GENERAL_LANGUAGE, languageOfPath } from '@/languages.js';
import type { RunStore } from '@/state/store.js';
import {
  gateDecision,
  type Denial,
  type GateTarget,
} from '@/guidelines/gate.js';
import { collectFindings, evaluate } from '@/rules/index.js';
import { blockedReason } from '@/rules/report.js';
import type { Finding } from '@/rules/types.js';
import type { MutationInspection } from '@/mutations/changes.js';
import type { PendingNote, PendingNotes } from '@/mutations/pending-notes.js';

export interface InspectorSettings {
  guidelines: GuidelinesSettings;
  rules: RulesSettings;
}

export interface MutationInspectorDeps {
  settings: InspectorSettings;
  store: RunStore;
  notes: PendingNotes;
}

export interface MutationInspector {
  inspect(call: MutationInspection): Promise<Denial | null>;
}

interface RuleOutcome {
  blockedFilePath: string | null;
  blocks: Finding[];
  notes: PendingNote[];
}

export function createMutationInspector({
  settings,
  store,
  notes,
}: MutationInspectorDeps): MutationInspector {
  function targetsOf(call: MutationInspection): GateTarget[] {
    return call.changes
      .filter((change) => change.path !== '')
      .map((change) => ({
        target: change.path,
        language: languageOfPath(change.path),
      }));
  }

  function inspectRules(call: MutationInspection): RuleOutcome {
    const outcome: RuleOutcome = {
      blockedFilePath: null,
      blocks: [],
      notes: [],
    };
    for (const change of call.changes) {
      if (change.path === '' || change.added.length === 0) {
        continue;
      }
      const language = languageOfPath(change.path);
      if (language === GENERAL_LANGUAGE) {
        continue;
      }
      const evaluation = evaluate({
        findings: collectFindings({ lines: change.added, language }),
        config: settings.rules,
        breaker: store.breaker,
        agentId: call.agentId,
      });
      if (evaluation.blocks.length > 0) {
        outcome.blockedFilePath = change.path;
        outcome.blocks = evaluation.blocks;
        return outcome;
      }
      if (evaluation.notes.length > 0) {
        outcome.notes.push({ target: change.path, notes: evaluation.notes });
      }
    }
    return outcome;
  }

  function decide(call: MutationInspection): Denial | null {
    if (!isMutationTool(call.toolName)) {
      return null;
    }
    const targets = targetsOf(call);
    if (targets.length === 0) {
      return null;
    }
    const denial = gateDecision({
      store,
      settings: settings.guidelines,
      agentId: call.agentId,
      toolName: call.toolName,
      targets,
    });
    if (denial !== null || !settings.rules.enabled) {
      return denial;
    }
    const outcome = inspectRules(call);
    if (outcome.blockedFilePath !== null) {
      return {
        kind: 'deny',
        reason: blockedReason({
          toolName: call.toolName,
          filePath: outcome.blockedFilePath,
          blocks: outcome.blocks,
        }),
      };
    }
    if (outcome.notes.length > 0) {
      notes.remember(call.callId, outcome.notes);
    }
    return null;
  }

  function inspect(call: MutationInspection): Promise<Denial | null> {
    return Promise.resolve(decide(call));
  }

  return { inspect };
}
