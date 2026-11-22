import {
  CREDENTIAL_SOURCE_ENVIRONMENT,
  CREDENTIAL_SOURCE_STORE,
  STORE_PHASE,
} from '../constants';
import type { JevSnapshot, TranslateFn } from '../types';

export type KeyTone = 'ok' | 'missing' | 'failed' | 'loading';

export function chipTitle(t: TranslateFn, snapshot: JevSnapshot): string {
  if (snapshot.phase !== STORE_PHASE.ready) {
    return t('chip.title.unavailable');
  }
  return snapshot.key?.configured === true
    ? t('chip.title.withKey')
    : t('chip.title.withoutKey');
}

export function keyTone(snapshot: JevSnapshot): KeyTone {
  if (snapshot.phase === STORE_PHASE.failed) {
    return 'failed';
  }
  if (snapshot.phase === STORE_PHASE.loading) {
    return 'loading';
  }
  return snapshot.key?.configured === true ? 'ok' : 'missing';
}

export function keyLabel(t: TranslateFn, snapshot: JevSnapshot): string {
  if (snapshot.phase === STORE_PHASE.failed) {
    return t('key.source.unavailable');
  }
  if (snapshot.key === undefined) {
    return snapshot.phase === STORE_PHASE.loading
      ? t('key.source.loading')
      : t('key.source.missing');
  }
  if (snapshot.key.configured !== true) {
    return t('key.source.missing');
  }
  if (snapshot.key.source === CREDENTIAL_SOURCE_ENVIRONMENT) {
    return t('key.source.environment');
  }
  return t('key.source.stored');
}

export function keySourceText(t: TranslateFn, snapshot: JevSnapshot): string {
  if (snapshot.phase === STORE_PHASE.failed) {
    return t('key.unavailable');
  }
  const key = snapshot.key;
  if (key === undefined) {
    return snapshot.phase === STORE_PHASE.loading
      ? t('key.loading')
      : t('key.missing', { name: snapshot.keyEnv });
  }
  if (key.configured !== true) {
    return t('key.missing', { name: snapshot.keyEnv });
  }
  if (key.source === CREDENTIAL_SOURCE_ENVIRONMENT) {
    return t('key.fromEnvironment', { name: snapshot.keyEnv });
  }
  if (key.source === CREDENTIAL_SOURCE_STORE) {
    return t('key.stored', { name: snapshot.keyEnv });
  }
  return t('key.configured', { name: snapshot.keyEnv });
}

export function keyMaskedText(snapshot: JevSnapshot): string | undefined {
  if (snapshot.key?.configured !== true) {
    return undefined;
  }
  return snapshot.key.masked;
}

export function keyLockedByEnvironment(snapshot: JevSnapshot): boolean {
  return snapshot.key?.source === CREDENTIAL_SOURCE_ENVIRONMENT;
}

export function keyEditable(snapshot: JevSnapshot): boolean {
  if (snapshot.phase !== STORE_PHASE.ready) {
    return false;
  }
  if (snapshot.key?.writable === false) {
    return false;
  }
  return !keyLockedByEnvironment(snapshot);
}
