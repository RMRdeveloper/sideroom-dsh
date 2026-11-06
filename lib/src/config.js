import { RULE_IDS } from './rules/types.js';
const SECTION_KEYS = [
    'guidelines',
    'rules',
    'review',
    'prompt',
    'checks',
    'skills',
];
const KNOWN_KEYS = {
    guidelines: ['enabled', 'gateUnrecognized'],
    rules: ['enabled', 'blocking', 'notes', 'degradeAfter', 'resetAfter'],
    review: ['enabled'],
    prompt: ['contract', 'explain'],
    checks: ['enabled'],
    skills: ['enabled', 'packaged', 'monorepo', 'maxDepth'],
};
export const DEFAULTS = {
    guidelines: {
        enabled: true,
        gateUnrecognized: false,
    },
    rules: {
        enabled: true,
        blocking: ['braced-conditionals', 'swallowed-errors'],
        notes: [
            'clear-names',
            'stale-comments',
            'commented-code',
            'debug-artifacts',
        ],
        degradeAfter: 3,
        resetAfter: 5,
    },
    review: {
        enabled: true,
    },
    prompt: {
        contract: true,
        explain: true,
    },
    checks: {
        enabled: true,
    },
    skills: {
        enabled: true,
        packaged: true,
        monorepo: true,
        maxDepth: 3,
    },
};
function sourceObjectOf(config) {
    if (config === undefined || config === null) {
        return {};
    }
    if (typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('sideroom-dsh: the bundle config must be an object');
    }
    return config;
}
function sectionOf(source, key) {
    const section = source[key];
    if (section === undefined || section === null) {
        return {};
    }
    if (typeof section !== 'object' || Array.isArray(section)) {
        throw new Error(`sideroom-dsh: config.${key} must be an object`);
    }
    return section;
}
function readerFor(source, key) {
    const section = sectionOf(source, key);
    const path = `config.${key}`;
    return {
        flag(name, fallback) {
            const candidate = section[name];
            if (candidate === undefined) {
                return fallback;
            }
            if (typeof candidate !== 'boolean') {
                throw new Error(`sideroom-dsh: ${path}.${name} must be a boolean`);
            }
            return candidate;
        },
        count(name, fallback) {
            const candidate = section[name];
            if (candidate === undefined) {
                return fallback;
            }
            if (typeof candidate !== 'number' ||
                !Number.isInteger(candidate) ||
                candidate < 0) {
                throw new Error(`sideroom-dsh: ${path}.${name} must be a non-negative integer`);
            }
            return candidate;
        },
        ruleIds(name, fallback) {
            const candidate = section[name];
            if (candidate === undefined) {
                return [...fallback];
            }
            if (!Array.isArray(candidate)) {
                throw new Error(`sideroom-dsh: ${path}.${name} must be a list of rule ids`);
            }
            const unknown = candidate.filter((entry) => typeof entry !== 'string' || !RULE_IDS.includes(entry));
            if (unknown.length > 0) {
                throw new Error(`sideroom-dsh: ${path}.${name} has unknown rule ids: ${unknown
                    .map((entry) => String(entry))
                    .join(', ')}`);
            }
            return candidate;
        },
        unknown(known) {
            return Object.keys(section)
                .filter((entry) => !known.includes(entry))
                .map((entry) => `${path}.${entry} is not a known setting`);
        },
    };
}
export function normalizeConfig(config) {
    const source = sourceObjectOf(config);
    const warnings = [];
    for (const key of Object.keys(source)) {
        if (!SECTION_KEYS.includes(key)) {
            warnings.push(`config.${key} is not a known section`);
        }
    }
    const guidelines = readerFor(source, 'guidelines');
    const rules = readerFor(source, 'rules');
    const review = readerFor(source, 'review');
    const prompt = readerFor(source, 'prompt');
    const checks = readerFor(source, 'checks');
    const skills = readerFor(source, 'skills');
    for (const key of SECTION_KEYS) {
        warnings.push(...readerFor(source, key).unknown(KNOWN_KEYS[key]));
    }
    const settings = {
        guidelines: {
            enabled: guidelines.flag('enabled', DEFAULTS.guidelines.enabled),
            gateUnrecognized: guidelines.flag('gateUnrecognized', DEFAULTS.guidelines.gateUnrecognized),
        },
        rules: {
            enabled: rules.flag('enabled', DEFAULTS.rules.enabled),
            blocking: rules.ruleIds('blocking', DEFAULTS.rules.blocking),
            notes: rules.ruleIds('notes', DEFAULTS.rules.notes),
            degradeAfter: rules.count('degradeAfter', DEFAULTS.rules.degradeAfter),
            resetAfter: rules.count('resetAfter', DEFAULTS.rules.resetAfter),
        },
        review: {
            enabled: review.flag('enabled', DEFAULTS.review.enabled),
        },
        prompt: {
            contract: prompt.flag('contract', DEFAULTS.prompt.contract),
            explain: prompt.flag('explain', DEFAULTS.prompt.explain),
        },
        checks: {
            enabled: checks.flag('enabled', DEFAULTS.checks.enabled),
        },
        skills: {
            enabled: skills.flag('enabled', DEFAULTS.skills.enabled),
            packaged: skills.flag('packaged', DEFAULTS.skills.packaged),
            monorepo: skills.flag('monorepo', DEFAULTS.skills.monorepo),
            maxDepth: skills.count('maxDepth', DEFAULTS.skills.maxDepth),
        },
    };
    for (const rule of settings.rules.blocking) {
        if (settings.rules.notes.includes(rule)) {
            warnings.push(`rule "${rule}" is configured as both blocking and a note; blocking wins`);
        }
    }
    return { settings, warnings };
}
