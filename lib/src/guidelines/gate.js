import { GENERAL_LANGUAGE } from '../languages.js';
import { CONTRACT_SLOT } from './slots.js';
export function coversLanguage(settings, language) {
    return language !== GENERAL_LANGUAGE || settings.gateUnrecognized;
}
export function gateDecision({ store, settings, agentId, toolName, target, language, }) {
    if (!settings.enabled) {
        return null;
    }
    if (!coversLanguage(settings, language)) {
        return null;
    }
    const missing = [CONTRACT_SLOT, language].filter((slot) => !store.isLoaded(agentId, slot));
    if (missing.length === 0) {
        return null;
    }
    return {
        kind: 'deny',
        reason: [
            'Sideroom gate: the coding guidelines are not loaded for this run, so this mutation is blocked.',
            `Call sideroom_guidelines with {"path": ${JSON.stringify(target)}} and retry this ${toolName}.`,
            'The call returns the 20 canonical rules plus the matching language guide.',
        ].join(' '),
    };
}
