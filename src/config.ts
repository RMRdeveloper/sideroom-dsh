import { RULE_IDS, type RuleId, type RulePolicy } from './rules/types.js'

export interface GuidelinesSettings {
  enabled: boolean
  gateUnrecognized: boolean
}

export interface RulesSettings extends RulePolicy {
  enabled: boolean
}

export interface ReviewSettings {
  enabled: boolean
}

export interface PromptSettings {
  contract: boolean
  explain: boolean
}

export interface ChecksSettings {
  enabled: boolean
}

export interface SkillsSettings {
  enabled: boolean
  packaged: boolean
  monorepo: boolean
  maxDepth: number
}

export interface SideroomConfig {
  guidelines: GuidelinesSettings
  rules: RulesSettings
  review: ReviewSettings
  prompt: PromptSettings
  checks: ChecksSettings
  skills: SkillsSettings
}

export interface NormalizedConfig {
  settings: SideroomConfig
  warnings: string[]
}

const SECTION_KEYS = [
  'guidelines',
  'rules',
  'review',
  'prompt',
  'checks',
  'skills',
] as const

type SectionKey = (typeof SECTION_KEYS)[number]

const KNOWN_KEYS: Record<SectionKey, readonly string[]> = {
  guidelines: ['enabled', 'gateUnrecognized'],
  rules: ['enabled', 'blocking', 'notes', 'degradeAfter', 'resetAfter'],
  review: ['enabled'],
  prompt: ['contract', 'explain'],
  checks: ['enabled'],
  skills: ['enabled', 'packaged', 'monorepo', 'maxDepth'],
}

export const DEFAULTS: SideroomConfig = {
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
}

interface SectionReader {
  flag(key: string, fallback: boolean): boolean
  count(key: string, fallback: number): number
  ruleIds(key: string, fallback: RuleId[]): RuleId[]
  unknown(known: readonly string[]): string[]
}

function sourceObjectOf(config: unknown): Record<string, unknown> {
  if (config === undefined || config === null) {
    return {}
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('sideroom-dsh: the bundle config must be an object')
  }
  return config as Record<string, unknown>
}

function sectionOf(
  source: Record<string, unknown>,
  key: SectionKey
): Record<string, unknown> {
  const section = source[key]
  if (section === undefined || section === null) {
    return {}
  }
  if (typeof section !== 'object' || Array.isArray(section)) {
    throw new Error(`sideroom-dsh: config.${key} must be an object`)
  }
  return section as Record<string, unknown>
}

function readerFor(
  source: Record<string, unknown>,
  key: SectionKey
): SectionReader {
  const section = sectionOf(source, key)
  const path = `config.${key}`
  return {
    flag(name: string, fallback: boolean): boolean {
      const candidate = section[name]
      if (candidate === undefined) {
        return fallback
      }
      if (typeof candidate !== 'boolean') {
        throw new Error(`sideroom-dsh: ${path}.${name} must be a boolean`)
      }
      return candidate
    },

    count(name: string, fallback: number): number {
      const candidate = section[name]
      if (candidate === undefined) {
        return fallback
      }
      if (
        typeof candidate !== 'number' ||
        !Number.isInteger(candidate) ||
        candidate < 0
      ) {
        throw new Error(
          `sideroom-dsh: ${path}.${name} must be a non-negative integer`
        )
      }
      return candidate
    },

    ruleIds(name: string, fallback: RuleId[]): RuleId[] {
      const candidate = section[name]
      if (candidate === undefined) {
        return [...fallback]
      }
      if (!Array.isArray(candidate)) {
        throw new Error(
          `sideroom-dsh: ${path}.${name} must be a list of rule ids`
        )
      }
      const unknown = candidate.filter(
        (entry) =>
          typeof entry !== 'string' || !RULE_IDS.includes(entry as RuleId)
      )
      if (unknown.length > 0) {
        throw new Error(
          `sideroom-dsh: ${path}.${name} has unknown rule ids: ${unknown
            .map((entry) => String(entry))
            .join(', ')}`
        )
      }
      return candidate as RuleId[]
    },

    unknown(known: readonly string[]): string[] {
      return Object.keys(section)
        .filter((entry) => !known.includes(entry))
        .map((entry) => `${path}.${entry} is not a known setting`)
    },
  }
}

export function normalizeConfig(config: unknown): NormalizedConfig {
  const source = sourceObjectOf(config)
  const warnings: string[] = []
  for (const key of Object.keys(source)) {
    if (!SECTION_KEYS.includes(key as SectionKey)) {
      warnings.push(`config.${key} is not a known section`)
    }
  }

  const guidelines = readerFor(source, 'guidelines')
  const rules = readerFor(source, 'rules')
  const review = readerFor(source, 'review')
  const prompt = readerFor(source, 'prompt')
  const checks = readerFor(source, 'checks')
  const skills = readerFor(source, 'skills')

  for (const key of SECTION_KEYS) {
    warnings.push(...readerFor(source, key).unknown(KNOWN_KEYS[key]))
  }

  const settings: SideroomConfig = {
    guidelines: {
      enabled: guidelines.flag('enabled', DEFAULTS.guidelines.enabled),
      gateUnrecognized: guidelines.flag(
        'gateUnrecognized',
        DEFAULTS.guidelines.gateUnrecognized
      ),
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
  }

  for (const rule of settings.rules.blocking) {
    if (settings.rules.notes.includes(rule)) {
      warnings.push(
        `rule "${rule}" is configured as both blocking and a note; blocking wins`
      )
    }
  }

  return { settings, warnings }
}
