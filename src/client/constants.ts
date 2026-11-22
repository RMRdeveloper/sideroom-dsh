export const PACKAGE_ID = '@rmrdeveloper/sideroom-dsh';

export const SLOT_NAME = 'conversation.composer.dock';
export const SLOT_ID = 'jev';
export const SLOT_ORDER = 30;
export const LOCALE_NAMESPACE = 'sideroom-jev';
export const CHIP_LABEL = 'Jev';

export const DEFAULT_KEY_ENV = 'TYPESAFE_API_KEY';
export const STATUS_COMMAND = '/jev status';
export const CREDENTIAL_UPDATE_EVENT = 'credentials/reference-updated';

export const CREDENTIAL_SOURCE_ENVIRONMENT = 'env';
export const CREDENTIAL_SOURCE_STORE = 'file';

export const STYLE_ATTRIBUTE = 'data-sideroom-jev';
export const KEY_ENV_LINE = /^keyEnv:[ \t]*(.+?)[ \t]*$/mu;

export const STORE_PHASE = {
  idle: 'idle',
  loading: 'loading',
  ready: 'ready',
  failed: 'failed',
} as const;

export type StorePhase = (typeof STORE_PHASE)[keyof typeof STORE_PHASE];
