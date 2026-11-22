import { Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
import { useCallback, useState, type ReactElement } from 'react';
import { CHIP_LABEL } from '../constants';
import { chipTitle, keyTone } from '../model/key-view';
import type { JevSnapshot, JevStore, TranslateFn } from '../types';
import { KEY_TONE_STATE } from './dot-state';
import { JevDialog } from './jev-dialog';

export interface JevChipProps {
  t: TranslateFn;
  sessionId: string | undefined;
  useJevState: <T>(selector: (snapshot: JevSnapshot) => T) => T;
  jev: JevStore;
}

export function JevChip({
  t,
  sessionId,
  useJevState,
  jev,
}: JevChipProps): ReactElement {
  const snapshot = useJevState((current) => current);
  const [open, setOpen] = useState(false);
  const openDialog = useCallback((): void => {
    setOpen(true);
  }, []);
  const closeDialog = useCallback((): void => {
    setOpen(false);
  }, []);
  const title = chipTitle(t, snapshot);
  return (
    <>
      <Pill
        className="sideroom-jev__chip"
        active={open}
        title={title}
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openDialog}
      >
        <StateDot state={KEY_TONE_STATE[keyTone(snapshot)]} />
        {CHIP_LABEL}
      </Pill>
      <JevDialog
        open={open}
        onClose={closeDialog}
        t={t}
        sessionId={sessionId}
        snapshot={snapshot}
        jev={jev}
      />
    </>
  );
}
