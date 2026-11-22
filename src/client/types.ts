import type { StorePhase } from './constants';

export type TranslateFn = (key: string, params?: Record<string, string>) => string;

export interface CredentialView {
  configured: boolean;
  source?: string;
  masked?: string;
  writable?: boolean;
}

export interface RemoteSuccess<T> {
  ok: true;
  value: T;
}

export interface RemoteFailure {
  ok: false;
  error: { message: string };
}

export type RemoteAnswer<T> = RemoteSuccess<T> | RemoteFailure;

export interface CommandOutcome {
  result?: {
    kind: string;
    text?: string;
  };
}

export interface CredentialPort {
  describe(refs: string[]): Promise<RemoteAnswer<Record<string, CredentialView>>>;
  set(ref: string, value: string): Promise<RemoteAnswer<unknown>>;
  unset(ref: string): Promise<RemoteAnswer<unknown>>;
}

export interface CommandPort {
  execute(
    sessionId: string,
    line: string,
  ): Promise<RemoteAnswer<CommandOutcome | undefined>>;
}

export interface JevStatusState {
  phase: StorePhase;
  text?: string;
  error?: string;
  sessionId?: string;
}

export interface JevSnapshot {
  phase: StorePhase;
  keyEnv: string;
  key?: CredentialView;
  error?: string;
  status: JevStatusState;
}

export interface JevStore {
  getSnapshot(): JevSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  saveKey(value: string): Promise<string | undefined>;
  removeKey(): Promise<string | undefined>;
  loadStatus(sessionId: string | undefined): Promise<void>;
}
