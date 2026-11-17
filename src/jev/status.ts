import type { JevKey } from '@/jev/key.js';
import { JEV_STATUS, type JevStatus } from '@/jev/state.js';

export const NO_KEY_SOURCE = 'missing';
export const JEV_OFF_STATUS = 'off';
const KEY_ENV_FIELD = 'keyEnv';
const NO_MUTED_RULES = 'none';

export type JevKeySource = JevKey['origin'] | typeof NO_KEY_SOURCE;
export type JevReportStatus = JevStatus | typeof JEV_OFF_STATUS;

export interface JevReportInput {
  enabled: boolean;
  keyEnv: string;
  key: JevKey | undefined;
  model: string;
  cutoff: number;
  gate: number;
  runtime: JevStatus;
  calls: number;
  muted: readonly string[];
}

export interface JevReport {
  enabled: boolean;
  keyEnv: string;
  keySource: JevKeySource;
  model: string;
  status: JevReportStatus;
  calls: number;
  cutoff: number;
  gate: number;
  muted: string[];
}

export function buildJevReport({
  enabled,
  keyEnv,
  key,
  model,
  cutoff,
  gate,
  runtime,
  calls,
  muted,
}: JevReportInput): JevReport {
  return {
    enabled,
    keyEnv,
    keySource: key?.origin ?? NO_KEY_SOURCE,
    model,
    status: reportStatusOf({ enabled, key, runtime }),
    calls,
    cutoff,
    gate,
    muted: [...muted].sort(),
  };
}

function reportStatusOf({
  enabled,
  key,
  runtime,
}: Pick<JevReportInput, 'enabled' | 'key' | 'runtime'>): JevReportStatus {
  if (!enabled) {
    return JEV_OFF_STATUS;
  }
  return key === undefined ? JEV_STATUS.noKey : runtime;
}

export function formatJevReport(report: JevReport): string {
  const lines = [
    'Jev review',
    `enabled: ${report.enabled}`,
    `${KEY_ENV_FIELD}: ${report.keyEnv}`,
    `key: ${report.keySource}`,
    `model: ${report.model}`,
    `status: ${report.status}`,
    `calls: ${report.calls}`,
    `cutoff: ${report.cutoff}`,
    `gate: ${report.gate}`,
    `muted: ${report.muted.length === 0 ? NO_MUTED_RULES : report.muted.join(', ')}`,
  ];
  const hint = hintFor(report);
  return hint === undefined ? lines.join('\n') : [...lines, hint].join('\n');
}

function hintFor(report: JevReport): string | undefined {
  if (!report.enabled) {
    return 'hint: set jev.enabled to true in the profile config to review changes';
  }
  if (report.keySource === NO_KEY_SOURCE) {
    return `hint: store a key for ${report.keyEnv} or export that environment variable`;
  }
  return undefined;
}
