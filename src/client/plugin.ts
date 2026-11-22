import type { ComponentType } from 'react';
import { JevChip, type JevChipProps } from './components/jev-chip';
import {
  CREDENTIAL_UPDATE_EVENT,
  LOCALE_NAMESPACE,
  SLOT_ID,
  SLOT_NAME,
  SLOT_ORDER,
} from './constants';
import { DICTIONARIES } from './locale';
import { runInBackground } from './run';
import { createJevStore } from './store';
import { installStyles } from './styles/install';
import type { CommandPort, CredentialPort, JevStore } from './types';

export const inject = [
  'slots',
  'locale',
  'remote',
  'remote.credentials',
  'remote.commands',
];

interface ClientRemote {
  credentials: CredentialPort;
  commands: CommandPort;
  $on(event: string, listener: (ref: string) => void): () => void;
}

interface SlotRegistration {
  name: string;
  id: string;
  order: number;
  locale: string;
  inject(): { hooks: { jevState: JevStore }; jev: JevStore };
}

interface ClientSlots {
  inject(name: string, callback: () => () => void): void;
  register(
    definition: SlotRegistration,
    component: ComponentType<JevChipProps>,
  ): () => void;
}

interface ClientLocale {
  register(
    namespace: string,
    locale: string,
    dictionary: Record<string, string>,
  ): () => void;
}

export interface ClientContext {
  effect(body: () => (() => void) | undefined): void;
  remote: ClientRemote;
  locale: ClientLocale;
  slots: ClientSlots;
}

export function apply(ctx: ClientContext): void {
  const credentials: CredentialPort = {
    describe: (refs) => ctx.remote.credentials.describe(refs),
    set: (ref, value) => ctx.remote.credentials.set(ref, value),
    unset: (ref) => ctx.remote.credentials.unset(ref),
  };
  const commands: CommandPort = {
    execute: (sessionId, line) => ctx.remote.commands.execute(sessionId, line),
  };
  const store = createJevStore({ credentials, commands });

  ctx.effect(() => installStyles());

  for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
    ctx.effect(() => ctx.locale.register(LOCALE_NAMESPACE, locale, dictionary));
  }

  ctx.effect(() => ctx.remote.$on(CREDENTIAL_UPDATE_EVENT, (ref) => {
    if (ref === store.getSnapshot().keyEnv) {
      runInBackground(store.refresh());
    }
  }));

  ctx.effect(() => {
    runInBackground(store.refresh());
    return () => undefined;
  });

  ctx.slots.inject(SLOT_NAME, () => ctx.slots.register(
    {
      name: SLOT_NAME,
      id: SLOT_ID,
      order: SLOT_ORDER,
      locale: LOCALE_NAMESPACE,
      inject: () => ({ hooks: { jevState: store }, jev: store }),
    },
    JevChip,
  ));
}
