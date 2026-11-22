import type { TranslateFn } from '../types';

export type PillTone = 'business' | 'error' | 'neutral' | 'success';

export const PILL_TONE = {
  business: 'business',
  error: 'error',
  neutral: 'neutral',
  success: 'success',
} as const;

export interface ReportField {
  name: string;
  value: string;
}

export interface ParsedReport {
  fields: ReportField[];
  hint?: string;
}

export interface StatusRow {
  name: string;
  label: string;
  value: string;
  tone: PillTone;
  mono: boolean;
  marked: boolean;
}

const REPORT_FIELD_ORDER = [
  'enabled',
  'keyEnv',
  'key',
  'model',
  'status',
  'calls',
  'cutoff',
  'gate',
  'muted',
];

const REPORT_STATUS_FIELD = 'status';
const REPORT_HINT_FIELD = 'hint';
const NO_MUTED_RULES = 'none';
const REPORT_FIELD_LINE = /^([a-z][a-zA-Z0-9]*):[ \t]*(.*)$/u;
const MONO_FIELDS: ReadonlySet<string> = new Set(['keyEnv', 'model']);
const REPORT_ENABLED_TRUE = 'true';

const REPORT_STATUS_VALUES = {
  ready: 'ready',
  noKey: 'noKey',
  off: 'off',
  quota: 'quota',
  auth: 'auth',
  rateLimited: 'rateLimited',
  unavailable: 'unavailable',
} as const;

const REPORT_LABELS: Record<string, string> = {
  enabled: 'status.fields.enabled',
  keyEnv: 'status.fields.keyEnv',
  key: 'status.fields.key',
  model: 'status.fields.model',
  status: 'status.fields.status',
  calls: 'status.fields.calls',
  cutoff: 'status.fields.cutoff',
  gate: 'status.fields.gate',
  muted: 'status.fields.muted',
};

const REPORT_KEY_SOURCE_LABELS: Record<string, string> = {
  environment: 'key.source.environment',
  credentials: 'key.source.stored',
  missing: 'key.source.missing',
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  [REPORT_STATUS_VALUES.ready]: 'status.state.ready',
  [REPORT_STATUS_VALUES.noKey]: 'status.state.noKey',
  [REPORT_STATUS_VALUES.off]: 'status.state.off',
  [REPORT_STATUS_VALUES.quota]: 'status.state.quota',
  [REPORT_STATUS_VALUES.auth]: 'status.state.auth',
  [REPORT_STATUS_VALUES.rateLimited]: 'status.state.rateLimited',
  [REPORT_STATUS_VALUES.unavailable]: 'status.state.unavailable',
};

const REPORT_STATUS_TONES: Record<string, PillTone> = {
  [REPORT_STATUS_VALUES.ready]: PILL_TONE.success,
  [REPORT_STATUS_VALUES.noKey]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.auth]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.quota]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.unavailable]: PILL_TONE.error,
  [REPORT_STATUS_VALUES.off]: PILL_TONE.neutral,
  [REPORT_STATUS_VALUES.rateLimited]: PILL_TONE.neutral,
};

export function parseReport(text: string): ParsedReport | undefined {
  const fields: ReportField[] = [];
  let hint: string | undefined;
  for (const rawLine of text.split('\n')) {
    const match = REPORT_FIELD_LINE.exec(rawLine.trim());
    if (match === null) {
      continue;
    }
    const name = match[1];
    const value = match[2].trim();
    if (name === REPORT_HINT_FIELD) {
      hint = value;
      continue;
    }
    fields.push({ name, value });
  }
  if (fields.length === 0) {
    return undefined;
  }
  return { fields, hint };
}

export function reportRowsOf(
  t: TranslateFn,
  fields: readonly ReportField[],
): StatusRow[] {
  return orderedReportFields(fields).map((field) => ({
    name: field.name,
    label: translateKnown({ t, labels: REPORT_LABELS, value: field.name }),
    value: reportValueOf(t, field),
    tone: reportToneOf(field),
    mono: MONO_FIELDS.has(field.name),
    marked: field.name === REPORT_STATUS_FIELD,
  }));
}

function orderedReportFields(fields: readonly ReportField[]): ReportField[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const known = REPORT_FIELD_ORDER
    .filter((name) => byName.has(name))
    .map((name) => byName.get(name))
    .filter((field): field is ReportField => field !== undefined);
  const unknown = fields.filter(
    (field) => !REPORT_FIELD_ORDER.includes(field.name),
  );
  return [...known, ...unknown];
}

function translateKnown({
  t,
  labels,
  value,
}: {
  t: TranslateFn;
  labels: Record<string, string>;
  value: string;
}): string {
  if (!Object.hasOwn(labels, value)) {
    return value;
  }
  return t(labels[value]);
}

function reportValueOf(t: TranslateFn, field: ReportField): string {
  if (field.name === 'enabled') {
    return field.value === REPORT_ENABLED_TRUE
      ? t('status.enabled.true')
      : t('status.enabled.false');
  }
  if (field.name === 'key') {
    return translateKnown({ t, labels: REPORT_KEY_SOURCE_LABELS, value: field.value });
  }
  if (field.name === REPORT_STATUS_FIELD) {
    return translateKnown({ t, labels: REPORT_STATUS_LABELS, value: field.value });
  }
  if (field.name === 'muted' && field.value === NO_MUTED_RULES) {
    return t('status.mutedNone');
  }
  return field.value;
}

function reportToneOf(field: ReportField): PillTone {
  if (field.name !== REPORT_STATUS_FIELD) {
    return PILL_TONE.neutral;
  }
  return REPORT_STATUS_TONES[field.value] ?? PILL_TONE.neutral;
}
