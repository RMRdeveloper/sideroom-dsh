import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ReactElement } from 'react';
import type { TranslateFn } from '../types';

export interface RemoveConfirmationProps {
  t: TranslateFn;
  saving: boolean;
  removing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveConfirmation({
  t,
  saving,
  removing,
  onConfirm,
  onCancel,
}: RemoveConfirmationProps): ReactElement {
  return (
    <div className="sideroom-jev__confirm">
      <p className="sideroom-jev__note">{t('key.removeConfirm')}</p>
      <div className="sideroom-jev__actions">
        <Button size="sm" variant="primary" disabled={saving} onClick={onConfirm}>
          {removing ? t('key.removing') : t('key.removeConfirmAction')}
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
          {t('key.cancel')}
        </Button>
      </div>
    </div>
  );
}
