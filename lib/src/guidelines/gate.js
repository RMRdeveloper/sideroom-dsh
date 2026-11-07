import { GENERAL_LANGUAGE } from '../languages.js';
import { CONTRACT_SLOT } from './slots.js';
export function coversLanguage(settings, language) {
    return language !== GENERAL_LANGUAGE || settings.gateUnrecognized;
}
function missingTargets({ store, settings, agentId, targets, }) {
    const seen = new Set();
    const missing = [];
    for (const target of targets) {
        if (!coversLanguage(settings, target.language)) {
            continue;
        }
        const key = `${target.target}\u0000${target.language}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        if (!store.isLoaded(agentId, CONTRACT_SLOT)
            || !store.isLoaded(agentId, target.language)) {
            missing.push(target);
        }
    }
    return missing;
}
function singleDenial(toolName, target) {
    return {
        kind: 'deny',
        reason: `Sideroom gate: the coding guidelines are not loaded for this run, so this mutation is blocked. Call sideroom_guidelines with {"path": ${JSON.stringify(target.target)}} and retry this ${toolName}. The call returns the 20 canonical rules plus the matching language guide.`,
    };
}
function manyDenial(toolName, targets) {
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
export function gateDecision(input) {
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
