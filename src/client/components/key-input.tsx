import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ChangeEvent, ReactElement } from 'react';
import type { TranslateFn } from '../types';

export interface KeyInputProps {
  t: TranslateFn;
  value: string;
  revealed: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggleReveal: () => void;
}

export function KeyInput({
  t,
  value,
  revealed,
  onChange,
  onToggleReveal,
}: KeyInputProps): ReactElement {
  return (
    <div className="sideroom-jev__field">
      <Input
        className="sideroom-jev__input"
        type={revealed ? 'text' : 'password'}
        value={value}
        placeholder={t('key.placeholder')}
        aria-label={t('key.heading')}
        autoComplete="off"
        spellCheck={false}
        onChange={onChange}
      />
      {value.trim() === ''
        ? null
        : (
            <Button size="sm" variant="ghost" onClick={onToggleReveal}>
              {revealed ? t('key.hide') : t('key.show')}
            </Button>
          )}
    </div>
  );
}
