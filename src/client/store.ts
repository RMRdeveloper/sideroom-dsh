import { DEFAULT_KEY_ENV, KEY_ENV_LINE, STATUS_COMMAND, STORE_PHASE } from './constants';
import type {
  CommandOutcome,
  CommandPort,
  CredentialPort,
  JevSnapshot,
  JevStatusState,
  JevStore,
  RemoteAnswer,
} from './types';

const EMPTY_STATUS: JevStatusState = Object.freeze({ phase: STORE_PHASE.idle });

export function createJevStore({
  credentials,
  commands,
}: {
  credentials: CredentialPort;
  commands: CommandPort;
}): JevStore {
  let snapshot: JevSnapshot = {
    phase: STORE_PHASE.loading,
    keyEnv: DEFAULT_KEY_ENV,
    status: EMPTY_STATUS,
  };
  const listeners = new Set<() => void>();

  function getSnapshot(): JevSnapshot {
    return snapshot;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function publish(patch: Partial<JevSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) {
      listener();
    }
  }

  async function readKey(): Promise<void> {
    const response = await credentials.describe([snapshot.keyEnv]);
    if (!response.ok) {
      publish({ phase: STORE_PHASE.failed, error: response.error.message });
      return;
    }
    publish({
      phase: STORE_PHASE.ready,
      error: undefined,
      key: response.value[snapshot.keyEnv],
    });
  }

  async function refresh(): Promise<void> {
    try {
      await readKey();
    } catch (error) {
      publish({ phase: STORE_PHASE.failed, error: messageOf(error) });
    }
  }

  async function runWrite(
    operation: () => Promise<RemoteAnswer<unknown>>,
  ): Promise<string | undefined> {
    try {
      const response = await operation();
      if (!response.ok) {
        return response.error.message;
      }
      await refresh();
      return undefined;
    } catch (error) {
      return messageOf(error);
    }
  }

  function saveKey(value: string): Promise<string | undefined> {
    return runWrite(() => credentials.set(snapshot.keyEnv, value));
  }

  function removeKey(): Promise<string | undefined> {
    return runWrite(() => credentials.unset(snapshot.keyEnv));
  }

  async function loadStatus(sessionId: string | undefined): Promise<void> {
    if (sessionId === undefined) {
      publish({ status: statusFailure({ sessionId, error: undefined }) });
      return;
    }
    publish({ status: statusLoading({ sessionId, text: snapshot.status.text }) });
    try {
      const response = await commands.execute(sessionId, STATUS_COMMAND);
      if (!response.ok) {
        publish({
          status: statusFailure({ sessionId, error: response.error.message }),
        });
        return;
      }
      const answer = statusAnswerOf(response.value);
      if (answer?.kind !== 'success' || answer.text === undefined) {
        publish({
          status: statusFailure({ sessionId, error: answer?.text }),
        });
        return;
      }
      const text = answer.text;
      const previousKeyEnv = snapshot.keyEnv;
      const keyEnv = keyEnvOf(text) ?? previousKeyEnv;
      publish({ status: statusReady({ sessionId, text }), keyEnv });
      if (keyEnv !== previousKeyEnv) {
        await refresh();
      }
    } catch (error) {
      publish({
        status: statusFailure({ sessionId, error: messageOf(error) }),
      });
    }
  }

  return { getSnapshot, subscribe, refresh, saveKey, removeKey, loadStatus };
}

function statusLoading({
  sessionId,
  text,
}: {
  sessionId: string;
  text: string | undefined;
}): JevStatusState {
  return { phase: STORE_PHASE.loading, text, sessionId };
}

function statusReady({
  sessionId,
  text,
}: {
  sessionId: string;
  text: string;
}): JevStatusState {
  return { phase: STORE_PHASE.ready, text, sessionId };
}

function statusFailure({
  sessionId,
  error,
}: {
  sessionId: string | undefined;
  error: string | undefined;
}): JevStatusState {
  return { phase: STORE_PHASE.failed, error, sessionId };
}

function statusAnswerOf(
  execution: CommandOutcome | undefined,
): CommandOutcome['result'] {
  return execution?.result;
}

function keyEnvOf(report: string): string | undefined {
  const match = KEY_ENV_LINE.exec(report);
  return match === null ? undefined : match[1];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
