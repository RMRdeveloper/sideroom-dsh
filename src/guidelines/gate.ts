import type { GuidelinesSettings } from '../config.js'
import { GENERAL_LANGUAGE } from '../languages.js'
import type { RunStore } from '../state/store.js'
import { CONTRACT_SLOT } from './slots.js'

export interface GateInput {
  store: RunStore
  settings: GuidelinesSettings
  agentId: string
  toolName: string
  target: string
  language: string
}

export interface Denial {
  kind: 'deny'
  reason: string
}

export function coversLanguage(
  settings: GuidelinesSettings,
  language: string
): boolean {
  return language !== GENERAL_LANGUAGE || settings.gateUnrecognized
}

export function gateDecision({
  store,
  settings,
  agentId,
  toolName,
  target,
  language,
}: GateInput): Denial | null {
  if (!settings.enabled) {
    return null
  }
  if (!coversLanguage(settings, language)) {
    return null
  }
  const missing = [CONTRACT_SLOT, language].filter(
    (slot) => !store.isLoaded(agentId, slot)
  )
  if (missing.length === 0) {
    return null
  }
  return {
    kind: 'deny',
    reason: [
      'Sideroom gate: the coding guidelines are not loaded for this run, so this mutation is blocked.',
      `Call sideroom_guidelines with {"path": ${JSON.stringify(target)}} and retry this ${toolName}.`,
      'The call returns the 20 canonical rules plus the matching language guide.',
    ].join(' '),
  }
}
