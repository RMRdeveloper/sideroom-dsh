import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
import {
  useCallback,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import {
  keyEditable,
  keyLabel,
  keyLockedByEnvironment,
  keyMaskedText,
  keySourceText,
  keyTone,
} from '../model/key-view';
import type { JevSnapshot, JevStore, TranslateFn } from '../types';
import { KEY_TONE_STATE } from './dot-state';
import { KeyInput } from './key-input';
import { RemoveConfirmation } from './remove-confirmation';

const BUSY = { save: 'save', remove: 'remove' } as const;
type KeyBusy = (typeof BUSY)[keyof typeof BUSY];

export interface CredentialSectionProps {
  t: TranslateFn;
  snapshot: JevSnapshot;
  jev: JevStore;
  onSaved: () => void;
}

export function CredentialSection({
  t,
  snapshot,
  jev,
  onSaved,
}: CredentialSectionProps): ReactElement {
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<KeyBusy | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const editable = keyEditable(snapshot);
  const locked = keyLockedByEnvironment(snapshot);
  const readOnly = snapshot.key?.writable === false;
  const saving = busy !== undefined;
  const hasDraft = draft.trim() !== '';

  const save = useCallback((): void => {
    if (saving || !editable || !hasDraft) {
      return;
    }
    setBusy(BUSY.save);
    setFailure(undefined);
    setNotice(undefined);
    jev.saveKey(draft.trim())
      .then((message) => {
        setBusy(undefined);
        if (message === undefined) {
          setDraft('');
          setRevealed(false);
          setNotice(t('key.saved'));
          onSaved();
          return;
        }
        setFailure(t('error.template', {
          action: t('error.action.save'),
          reason: message,
        }));
      })
      .catch((error: unknown) => {
        setBusy(undefined);
        setFailure(errorMessageOf(error));
      });
  }, [draft, editable, hasDraft, jev, onSaved, saving, t]);

  const remove = useCallback((): void => {
    if (saving) {
      return;
    }
    setBusy(BUSY.remove);
    setFailure(undefined);
    setNotice(undefined);
    jev.removeKey()
      .then((message) => {
        setBusy(undefined);
        setConfirmingRemove(false);
        if (message === undefined) {
          setNotice(t('key.removed'));
          onSaved();
          return;
        }
        setFailure(t('error.template', {
          action: t('error.action.remove'),
          reason: message,
        }));
      })
      .catch((error: unknown) => {
        setBusy(undefined);
        setConfirmingRemove(false);
        setFailure(errorMessageOf(error));
      });
  }, [jev, onSaved, saving, t]);

  const changeDraft = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setDraft(event.target.value);
    setFailure(undefined);
    setNotice(undefined);
  }, []);

  const toggleReveal = useCallback((): void => {
    setRevealed((current) => !current);
  }, []);

  const cancelRemove = useCallback((): void => {
    setConfirmingRemove(false);
  }, []);

  const requestRemove = useCallback((): void => {
    setConfirmingRemove(true);
  }, []);

  const pill = keyLabel(t, snapshot);
  const masked = keyMaskedText(snapshot);

  return (
    <section className="sideroom-jev__section">
      <header className="sideroom-jev__section-header">
        <h3 className="sideroom-jev__heading">{t('key.heading')}</h3>
        <span className="sideroom-jev__badge">
          <StateDot state={KEY_TONE_STATE[keyTone(snapshot)]} />
          {pill}
        </span>
      </header>
      <p className={snapshot.phase === 'failed' ? 'sideroom-jev__error' : 'sideroom-jev__source'}>
        {keySourceText(t, snapshot)}
      </p>
      {masked === undefined
        ? null
        : <code className="sideroom-jev__masked">{masked}</code>}
      {editable
        ? (
            <KeyInput
              t={t}
              value={draft}
              revealed={revealed}
              onChange={changeDraft}
              onToggleReveal={toggleReveal}
            />
          )
        : null}
      {editable && confirmingRemove
        ? (
            <RemoveConfirmation
              t={t}
              saving={saving}
              removing={busy === BUSY.remove}
              onConfirm={remove}
              onCancel={cancelRemove}
            />
          )
        : null}
      {editable && !confirmingRemove
        ? (
            <div className="sideroom-jev__actions">
              <Button size="sm" variant="primary" disabled={saving || !hasDraft} onClick={save}>
                {busy === BUSY.save ? t('key.saving') : t('key.save')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || snapshot.key?.configured !== true}
                onClick={requestRemove}
              >
                {t('key.remove')}
              </Button>
            </div>
          )
        : null}
      {failure === undefined
        ? null
        : (
            <p className="sideroom-jev__error" role="alert">{failure}</p>
          )}
      {notice === undefined
        ? null
        : (
            <p className="sideroom-jev__notice" role="status">{notice}</p>
          )}
      {!locked && readOnly
        ? (
            <p className="sideroom-jev__note">{t('key.readOnly')}</p>
          )
        : null}
      {locked
        ? (
            <p className="sideroom-jev__note">{t('key.environmentLocked', { name: snapshot.keyEnv })}</p>
          )
        : null}
      <p className="sideroom-jev__note">{t('key.privacy')}</p>
    </section>
  );
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
