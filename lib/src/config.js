import { JEV_CUTOFF, JEV_ENDPOINT, JEV_GATE_CUTOFF, JEV_MODEL, } from './jev/model.js';
import { RULE_IDS } from './rules/types.js';
const SECTION_KEYS = [
    'guidelines',
    'rules',
    'review',
    'prompt',
    'checks',
    'skills',
    'jev',
];
const KNOWN_KEYS = {
    guidelines: ['enabled', 'gateUnrecognized'],
    rules: ['enabled', 'blocking', 'notes', 'degradeAfter', 'resetAfter'],
    review: ['enabled'],
    prompt: ['contract', 'explain'],
    checks: ['enabled'],
    skills: ['enabled', 'packaged', 'monorepo', 'maxDepth'],
    jev: [
        'enabled',
        'keyEnv',
        'endpoint',
        'model',
        'cutoff',
        'gate',
        'maxNotes',
        'timeoutMs',
        'maxRelatedFiles',
        'scanForConsumers',
        'reviewPlans',
        'reviewWorkflows',
        'calibrate',
    ],
};
export const DEFAULTS = {
    guidelines: {
        enabled: true,
        gateUnrecognized: false,
    },
    rules: {
        enabled: true,
        blocking: ['braced-conditionals', 'explicit-any', 'swallowed-errors'],
        notes: [
            'clear-names',
            'stale-comments',
            'commented-code',
            'debug-artifacts',
            'suppressed-type-errors',
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
    jev: {
        enabled: false,
        keyEnv: 'TYPESAFE_API_KEY',
        endpoint: JEV_ENDPOINT,
        model: JEV_MODEL,
        cutoff: JEV_CUTOFF,
        gate: JEV_GATE_CUTOFF,
        maxNotes: 3,
        timeoutMs: 3_000,
        maxRelatedFiles: 4,
        scanForConsumers: false,
        reviewPlans: true,
        reviewWorkflows: true,
        calibrate: false,
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
            if (typeof candidate !== 'number'
                || !Number.isInteger(candidate)
                || candidate < 0) {
                throw new Error(`sideroom-dsh: ${path}.${name} must be a non-negative integer`);
            }
            return candidate;
        },
        text(name, fallback) {
            const candidate = section[name];
            if (candidate === undefined) {
                return fallback;
            }
            if (typeof candidate !== 'string' || candidate.trim() === '') {
                throw new Error(`sideroom-dsh: ${path}.${name} must be a non-empty string`);
            }
            return candidate.trim();
        },
        ratio(name, fallback) {
            const candidate = section[name];
            if (candidate === undefined) {
                return fallback;
            }
            if (typeof candidate !== 'number'
                || !Number.isFinite(candidate)
                || candidate < 0
                || candidate > 1) {
                throw new Error(`sideroom-dsh: ${path}.${name} must be a number between 0 and 1`);
            }
            return candidate;
        },
        positive(name, fallback) {
            const candidate = section[name];
            if (candidate === undefined) {
                return fallback;
            }
            if (typeof candidate !== 'number'
                || !Number.isInteger(candidate)
                || candidate < 1) {
                throw new Error(`sideroom-dsh: ${path}.${name} must be a positive integer`);
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
    const jev = readerFor(source, 'jev');
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
        jev: {
            enabled: jev.flag('enabled', DEFAULTS.jev.enabled),
            keyEnv: jev.text('keyEnv', DEFAULTS.jev.keyEnv),
            endpoint: jev.text('endpoint', DEFAULTS.jev.endpoint),
            model: jev.text('model', DEFAULTS.jev.model),
            cutoff: jev.ratio('cutoff', DEFAULTS.jev.cutoff),
            gate: jev.ratio('gate', DEFAULTS.jev.gate),
            maxNotes: jev.count('maxNotes', DEFAULTS.jev.maxNotes),
            timeoutMs: jev.positive('timeoutMs', DEFAULTS.jev.timeoutMs),
            maxRelatedFiles: jev.count('maxRelatedFiles', DEFAULTS.jev.maxRelatedFiles),
            scanForConsumers: jev.flag('scanForConsumers', DEFAULTS.jev.scanForConsumers),
            reviewPlans: jev.flag('reviewPlans', DEFAULTS.jev.reviewPlans),
            reviewWorkflows: jev.flag('reviewWorkflows', DEFAULTS.jev.reviewWorkflows),
            calibrate: jev.flag('calibrate', DEFAULTS.jev.calibrate),
        },
    };
    for (const rule of settings.rules.blocking) {
        if (settings.rules.notes.includes(rule)) {
            warnings.push(`rule "${rule}" is configured as both blocking and a note; blocking wins`);
        }
    }
    return { settings, warnings };
}
