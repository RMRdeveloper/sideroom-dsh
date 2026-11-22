import { STORE_PHASE } from '../constants';
import type { JevStatusState, TranslateFn } from '../types';
import { parseReport, reportRowsOf, type StatusRow } from './report';

export type StatusView
  = | { kind: 'report'; rows: StatusRow[]; hint?: string }
    | { kind: 'raw'; text: string }
    | { kind: 'text'; text: string }
    | { kind: 'error'; text: string; detail?: string };

export function statusViewOf({
  t,
  status,
  sessionId,
}: {
  t: TranslateFn;
  status: JevStatusState;
  sessionId: string | undefined;
}): StatusView {
  if (status.phase === STORE_PHASE.failed) {
    return failedView({ t, status });
  }
  if (status.text !== undefined) {
    const parsed = parseReport(status.text);
    if (parsed === undefined) {
      return { kind: 'raw', text: status.text };
    }
    return {
      kind: 'report',
      rows: reportRowsOf(t, parsed.fields),
      hint: parsed.hint,
    };
  }
  if (status.phase === STORE_PHASE.loading) {
    return { kind: 'text', text: t('status.loading') };
  }
  return {
    kind: 'text',
    text: sessionId === undefined ? t('status.noSession') : t('status.idle'),
  };
}

function failedView({
  t,
  status,
}: {
  t: TranslateFn;
  status: JevStatusState;
}): StatusView {
  if (status.error === undefined && status.sessionId === undefined) {
    return { kind: 'text', text: t('status.noSession') };
  }
  return { kind: 'error', text: t('status.failed'), detail: status.error };
}
