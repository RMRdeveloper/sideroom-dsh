import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ReactElement } from 'react';
import { STORE_PHASE } from '../constants';
import { statusViewOf, type StatusView } from '../model/status-view';
import type { JevStatusState, TranslateFn } from '../types';
import { StatusRows } from './status-rows';

export interface StatusSectionProps {
  t: TranslateFn;
  sessionId: string | undefined;
  status: JevStatusState;
  onRefresh: () => void;
}

export function StatusSection({
  t,
  sessionId,
  status,
  onRefresh,
}: StatusSectionProps): ReactElement {
  const view = statusViewOf({ t, status, sessionId });
  const refreshing = status.phase === STORE_PHASE.loading;
  return (
    <section className="sideroom-jev__section" aria-busy={refreshing}>
      <header className="sideroom-jev__section-header">
        <h3 className="sideroom-jev__heading">{t('status.heading')}</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={refreshing || sessionId === undefined}
        >
          {refreshing ? t('status.refreshing') : t('status.refresh')}
        </Button>
      </header>
      {statusBodyOf(view)}
    </section>
  );
}

function statusBodyOf(view: StatusView): ReactElement {
  if (view.kind === 'report') {
    return (
      <div className="sideroom-jev__report">
        <StatusRows rows={view.rows} />
        {view.hint === undefined
          ? null
          : <p className="sideroom-jev__hint">{view.hint}</p>}
      </div>
    );
  }
  if (view.kind === 'raw') {
    return <pre className="sideroom-jev__raw">{view.text}</pre>;
  }
  if (view.kind === 'error') {
    return (
      <p className="sideroom-jev__error">
        {view.detail === undefined ? view.text : `${view.text} ${view.detail}`}
      </p>
    );
  }
  return <p className="sideroom-jev__note">{view.text}</p>;
}
