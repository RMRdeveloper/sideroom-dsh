import type { GuidelinesSettings, RulesSettings } from '../config.js'
import { targetPathOf, stringArgument } from '../dsh/arguments.js'
import { WRITE_TOOL, isMutationTool } from '../dsh/tool-names.js'
import {
  coversLanguage,
  gateDecision,
  type Denial,
} from '../guidelines/gate.js'
import { languageOfPath } from '../languages.js'
import { collectFindings, evaluate } from '../rules/index.js'
import { blockedReason } from '../rules/report.js'
import type { RunStore } from '../state/store.js'
import { addedLines } from './added-lines.js'
import type { PendingNotes } from './pending-notes.js'

export type PreviousContent =
  { kind: 'text'; text: string } | { kind: 'absent' }

export interface MutationCall {
  toolName: string
  arguments: unknown
  callId: string
  agentId: string
  readPrevious(filePath: string): Promise<PreviousContent>
}

export interface InspectorSettings {
  guidelines: GuidelinesSettings
  rules: RulesSettings
}

export interface MutationInspectorDeps {
  settings: InspectorSettings
  store: RunStore
  notes: PendingNotes
}

export interface MutationInspector {
  inspect(call: MutationCall): Promise<Denial | null>
}

export function createMutationInspector({
  settings,
  store,
  notes,
}: MutationInspectorDeps): MutationInspector {
  async function addedContentOf(
    call: MutationCall,
    target: string
  ): Promise<string[]> {
    if (call.toolName === WRITE_TOOL) {
      const previous = await call.readPrevious(target)
      const before = previous.kind === 'text' ? previous.text : null
      return addedLines(before, stringArgument(call.arguments, 'content'))
    }
    return addedLines(
      stringArgument(call.arguments, 'old_string'),
      stringArgument(call.arguments, 'new_string')
    )
  }

  async function inspect(call: MutationCall): Promise<Denial | null> {
    if (!isMutationTool(call.toolName)) {
      return null
    }
    const target = targetPathOf(call.arguments)
    if (target === null) {
      return null
    }
    const language = languageOfPath(target)
    if (!coversLanguage(settings.guidelines, language)) {
      return null
    }
    const denial = gateDecision({
      store,
      settings: settings.guidelines,
      agentId: call.agentId,
      toolName: call.toolName,
      target,
      language,
    })
    if (denial !== null) {
      return denial
    }
    if (!settings.rules.enabled) {
      return null
    }
    const added = await addedContentOf(call, target)
    if (added.length === 0) {
      return null
    }
    const { blocks, notes: ruleNotes } = evaluate({
      findings: collectFindings({ lines: added, language }),
      config: settings.rules,
      breaker: store.breaker,
      agentId: call.agentId,
    })
    if (blocks.length > 0) {
      return {
        kind: 'deny',
        reason: blockedReason({
          toolName: call.toolName,
          filePath: target,
          blocks,
        }),
      }
    }
    if (ruleNotes.length > 0) {
      notes.remember(call.callId, { notes: ruleNotes, target })
    }
    return null
  }

  return { inspect }
}
