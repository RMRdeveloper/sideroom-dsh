import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { useCallback, useEffect, type ReactElement } from 'react';
import { STORE_PHASE } from '../constants';
import { runInBackground } from '../run';
import type { JevSnapshot, JevStore, TranslateFn } from '../types';
import { CredentialSection } from './credential-section';
import { StatusSection } from './status-section';

export interface JevDialogProps {
  open: boolean;
  onClose: () => void;
  t: TranslateFn;
  sessionId: string | undefined;
  snapshot: JevSnapshot;
  jev: JevStore;
}

export function JevDialog({
  open,
  onClose,
  t,
  sessionId,
  snapshot,
  jev,
}: JevDialogProps): ReactElement {
  const refresh = useCallback((): void => {
    runInBackground(jev.loadStatus(sessionId));
  }, [jev, sessionId]);

  useEffect(() => {
    if (!open || sessionId === undefined) {
      return;
    }
    const { phase, sessionId: loadedSessionId } = snapshot.status;
    if (phase !== STORE_PHASE.idle && loadedSessionId === sessionId) {
      return;
    }
    runInBackground(jev.loadStatus(sessionId));
  }, [jev, open, sessionId, snapshot.status]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('dialog.title')}
      description={t('dialog.description')}
      closeLabel={t('dialog.close')}
      className="sideroom-jev__dialog"
      footer={<Button variant="outline" onClick={onClose}>{t('dialog.close')}</Button>}
    >
      <div className="sideroom-jev__sections">
        <CredentialSection t={t} snapshot={snapshot} jev={jev} onSaved={refresh} />
        <StatusSection
          t={t}
          sessionId={sessionId}
          status={snapshot.status}
          onRefresh={refresh}
        />
      </div>
    </Modal>
  );
}
