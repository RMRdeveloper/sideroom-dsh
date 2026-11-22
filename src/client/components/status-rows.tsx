import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives';
import type { ReactElement } from 'react';
import type { StatusRow } from '../model/report';
import { PILL_TONE_STATE } from './dot-state';

export function StatusRows({
  rows,
}: {
  rows: readonly StatusRow[];
}): ReactElement {
  return (
    <dl className="sideroom-jev__rows">
      {rows.map((row) => (
        <div key={row.name} className="sideroom-jev__row">
          <dt className="sideroom-jev__term">{row.label}</dt>
          <dd
            className={row.mono
              ? 'sideroom-jev__value sideroom-jev__mono'
              : 'sideroom-jev__value'}
          >
            {row.marked ? <StateDot state={PILL_TONE_STATE[row.tone]} /> : null}
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
