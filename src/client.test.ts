import assert from 'node:assert/strict';
import { test } from 'node:test';

const LOADER_ID = '@rmrdeveloper/sideroom-dsh';
const SESSION_ID = 'session-1';
const DEFAULT_REF = 'TYPESAFE_API_KEY';
const ALT_REF = 'MY_JEV_KEY';
const STATUS_REPORT = [
  'Jev review',
  'enabled: true',
  `keyEnv: ${DEFAULT_REF}`,
  'key: file',
  'model: jev-latest',
  'status: ready',
  'calls: 2',
].join('\n');

interface ClientPlugin {
  inject: readonly string[];
  apply(ctx: unknown): void;
}

interface LoaderCall {
  id: string;
  factory(require: (name: string) => unknown): unknown;
}

interface ReactElement {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

interface RemoteOk {
  ok: true;
  value: unknown;
}

interface RemoteFailed {
  ok: false;
  error: { message: string };
}

type RemoteAnswer = RemoteOk | RemoteFailed;

interface StoreSnapshot {
  phase: string;
  keyEnv: string;
  key:
    | {
      configured: boolean;
      source?: string;
      masked?: string;
      writable: boolean;
    }
    | undefined;
  error: string | undefined;
  status: {
    phase: string;
    text?: string;
    error?: string;
    sessionId?: string;
  };
}

interface Store {
  getSnapshot(): StoreSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  saveKey(value: string): Promise<string | undefined>;
  removeKey(): Promise<string | undefined>;
  loadStatus(sessionId: string | undefined): Promise<void>;
}

interface SlotOptions {
  name: string;
  id: string;
  order: number;
  locale: string;
  inject(): { hooks: Record<string, Store>; jev: Store };
}

interface Harness {
  plugin: ClientPlugin;
  slotOptions: SlotOptions | undefined;
  component: unknown;
  store: Store;
  dictionaries: string[];
  slotNames: string[];
  describeCalls: string[][];
  setCalls: Array<[string, string]>;
  unsetCalls: string[];
  commandCalls: Array<[string, string]>;
  emitCredentialUpdate(ref: string): void;
}

const CAPTURED: { call?: LoaderCall } = {};
const GLOBAL_RECORD = globalThis as unknown as Record<string, unknown>;
GLOBAL_RECORD.window = {
  __ModuleLoader__: {
    load(call: LoaderCall): void {
      CAPTURED.call = call;
    },
  },
};
GLOBAL_RECORD.document = { body: {} };

await import(new URL('../../client.js', import.meta.url).href);

const REACT_STUB = {
  Fragment: 'Fragment',
  createElement(
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ): ReactElement {
    return { type, props: props ?? {}, children };
  },
  useCallback(callback: unknown): unknown {
    return callback;
  },
  useEffect(): void {},
  useRef(value: unknown): { current: unknown } {
    return { current: value };
  },
  useState(value: unknown): [unknown, () => void] {
    return [value, () => undefined];
  },
};

function fakeRequire(name: string): unknown {
  if (name === 'react') {
    return REACT_STUB;
  }
  if (name === 'react-dom') {
    return { createPortal: (node: unknown) => node };
  }
  throw new Error(`unexpected require: ${name}`);
}

function pluginOf(): ClientPlugin {
  const call = CAPTURED.call;
  assert.ok(call !== undefined, 'the bundle registered no module factory');
  assert.equal(call.id, LOADER_ID);
  return call.factory(fakeRequire) as ClientPlugin;
}

function harnessOf({
  describe = () =>
    Promise.resolve({
      ok: true,
      value: {
        [DEFAULT_REF]: {
          configured: true,
          source: 'file',
          masked: 'sk-...abcd',
          writable: true,
        },
      },
    } satisfies RemoteAnswer),
  set = () => Promise.resolve({ ok: true, value: undefined } satisfies RemoteAnswer),
  unset = () => Promise.resolve({ ok: true, value: undefined } satisfies RemoteAnswer),
  execute = () =>
    Promise.resolve({
      ok: true,
      value: { commandId: 'c-1', result: { kind: 'success', text: STATUS_REPORT } },
    } satisfies RemoteAnswer),
}: {
  describe?: (refs: string[]) => Promise<RemoteAnswer>;
  set?: (ref: string, value: string) => Promise<RemoteAnswer>;
  unset?: (ref: string) => Promise<RemoteAnswer>;
  execute?: (sessionId: string, line: string) => Promise<RemoteAnswer>;
} = {}): Harness {
  const plugin = pluginOf();
  const dictionaries: string[] = [];
  const slotNames: string[] = [];
  const describeCalls: string[][] = [];
  const setCalls: Array<[string, string]> = [];
  const unsetCalls: string[] = [];
  const commandCalls: Array<[string, string]> = [];
  const listeners = new Set<(ref: string) => void>();
  let slotOptions: SlotOptions | undefined;
  let component: unknown;

  const context = {
    locale: {
      register(_ns: string, locale: string): () => void {
        dictionaries.push(locale);
        return () => undefined;
      },
    },
    slots: {
      inject(name: string, callback: () => unknown): void {
        slotNames.push(name);
        callback();
      },
      register(options: SlotOptions, selected: unknown): () => void {
        slotOptions = options;
        component = selected;
        return () => undefined;
      },
    },
    remote: {
      credentials: {
        describe(refs: string[]): Promise<RemoteAnswer> {
          describeCalls.push(refs);
          return describe(refs);
        },
        set(ref: string, value: string): Promise<RemoteAnswer> {
          setCalls.push([ref, value]);
          return set(ref, value);
        },
        unset(ref: string): Promise<RemoteAnswer> {
          unsetCalls.push(ref);
          return unset(ref);
        },
      },
      commands: {
        execute(sessionId: string, line: string): Promise<RemoteAnswer> {
          commandCalls.push([sessionId, line]);
          return execute(sessionId, line);
        },
      },
      $on(_event: string, listener: (ref: string) => void): () => void {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    effect(body: () => unknown): () => void {
      const disposer = body();
      return typeof disposer === 'function' ? (disposer as () => void) : () => undefined;
    },
  };

  plugin.apply(context);

  const face = slotOptions?.inject();
  assert.ok(face !== undefined, 'the slot entry exposes no inject face');

  return {
    plugin,
    slotOptions,
    component,
    store: face.jev,
    dictionaries,
    slotNames,
    describeCalls,
    setCalls,
    unsetCalls,
    commandCalls,
    emitCredentialUpdate(ref: string): void {
      for (const listener of listeners) {
        listener(ref);
      }
    },
  };
}

test('the bundle registers the package module and its client services', () => {
  const plugin = pluginOf();
  assert.deepEqual(plugin.inject, [
    'slots',
    'locale',
    'remote',
    'remote.credentials',
    'remote.commands',
  ]);
});

test('the bundle fills the composer dock with one localized chip', () => {
  const harness = harnessOf();
  assert.deepEqual(harness.slotNames, ['conversation.composer.dock']);
  assert.equal(harness.slotOptions?.name, 'conversation.composer.dock');
  assert.equal(harness.slotOptions?.id, 'jev');
  assert.equal(harness.slotOptions?.order, 30);
  assert.equal(harness.slotOptions?.locale, 'sideroom-jev');
  assert.deepEqual(harness.dictionaries, ['en', 'es']);
});

test('the first read describes the default credential reference', async () => {
  const harness = harnessOf();
  await harness.store.refresh();
  const references = harness.describeCalls.map((call) => call[0]);
  assert.ok(references.length > 0);
  assert.deepEqual(new Set(references), new Set([DEFAULT_REF]));
  const snapshot = harness.store.getSnapshot();
  assert.equal(snapshot.phase, 'ready');
  assert.equal(snapshot.key?.configured, true);
  assert.equal(snapshot.key?.source, 'file');
});

test('a refused describe reports the failure', async () => {
  const harness = harnessOf({
    describe: () =>
      Promise.resolve({ ok: false, error: { message: 'store unavailable' } }),
  });
  await harness.store.refresh();
  const snapshot = harness.store.getSnapshot();
  assert.equal(snapshot.phase, 'failed');
  assert.equal(snapshot.error, 'store unavailable');
});

test('saving writes the reference and reads it back', async () => {
  const harness = harnessOf();
  const message = await harness.store.saveKey('sk-new');
  assert.equal(message, undefined);
  assert.deepEqual(harness.setCalls, [[DEFAULT_REF, 'sk-new']]);
  assert.equal(harness.describeCalls.length, 2);
});

test('a refused write returns the provider message', async () => {
  const harness = harnessOf({
    set: () =>
      Promise.resolve({ ok: false, error: { message: 'store is read-only' } }),
  });
  const message = await harness.store.saveKey('sk-new');
  assert.equal(message, 'store is read-only');
});

test('removing unsets the reference', async () => {
  const harness = harnessOf();
  const message = await harness.store.removeKey();
  assert.equal(message, undefined);
  assert.deepEqual(harness.unsetCalls, [DEFAULT_REF]);
});

test('a thrown write is reported as its message', async () => {
  const harness = harnessOf({
    set: () => Promise.reject(new Error('connection lost')),
  });
  assert.equal(await harness.store.saveKey('sk-new'), 'connection lost');
});

test('the status runs the host command and stores the report', async () => {
  const harness = harnessOf();
  await harness.store.loadStatus(SESSION_ID);
  assert.deepEqual(harness.commandCalls, [[SESSION_ID, '/jev status']]);
  const snapshot = harness.store.getSnapshot();
  assert.equal(snapshot.status.phase, 'ready');
  assert.equal(snapshot.status.text, STATUS_REPORT);
  assert.equal(snapshot.keyEnv, DEFAULT_REF);
});

test('a report naming another reference switches the key read', async () => {
  const report = STATUS_REPORT.replace(DEFAULT_REF, ALT_REF);
  const harness = harnessOf({
    execute: () =>
      Promise.resolve({
        ok: true,
        value: { commandId: 'c-1', result: { kind: 'success', text: report } },
      } satisfies RemoteAnswer),
  });
  await harness.store.loadStatus(SESSION_ID);
  assert.equal(harness.store.getSnapshot().keyEnv, ALT_REF);
  assert.deepEqual(harness.describeCalls.at(-1), [ALT_REF]);
});

test('a rejected status command reports the transport message', async () => {
  const harness = harnessOf({
    execute: () =>
      Promise.resolve({ ok: false, error: { message: 'no agent' } }),
  });
  await harness.store.loadStatus(SESSION_ID);
  const snapshot = harness.store.getSnapshot();
  assert.equal(snapshot.status.phase, 'failed');
  assert.equal(snapshot.status.error, 'no agent');
});

test('an error answer reports the command text', async () => {
  const harness = harnessOf({
    execute: () =>
      Promise.resolve({
        ok: true,
        value: {
          commandId: 'c-1',
          result: { kind: 'error', text: 'unknown /jev verb' },
        },
      } satisfies RemoteAnswer),
  });
  await harness.store.loadStatus(SESSION_ID);
  const snapshot = harness.store.getSnapshot();
  assert.equal(snapshot.status.phase, 'failed');
  assert.equal(snapshot.status.error, 'unknown /jev verb');
});

test('an unmatched command fails without a message', async () => {
  const harness = harnessOf({
    execute: () => Promise.resolve({ ok: true, value: undefined }),
  });
  await harness.store.loadStatus(SESSION_ID);
  const snapshot = harness.store.getSnapshot();
  assert.equal(snapshot.status.phase, 'failed');
  assert.equal(snapshot.status.error, undefined);
});

test('a status without a session does not reach the host', async () => {
  const harness = harnessOf();
  await harness.store.loadStatus(undefined);
  assert.deepEqual(harness.commandCalls, []);
  assert.equal(harness.store.getSnapshot().status.phase, 'failed');
});

test('a forwarded credential update refreshes only the tracked reference', async () => {
  const harness = harnessOf();
  await harness.store.refresh();
  const before = harness.describeCalls.length;
  harness.emitCredentialUpdate('SOME_OTHER_KEY');
  await Promise.resolve();
  assert.equal(harness.describeCalls.length, before);
  harness.emitCredentialUpdate(DEFAULT_REF);
  await Promise.resolve();
  assert.equal(harness.describeCalls.length, before + 1);
});

function renderChip(harness: Harness): ReactElement {
  const chip = harness.component as (
    props: Record<string, unknown>,
  ) => ReactElement;
  return chip({
    t: (key: string): string => key,
    sessionId: SESSION_ID,
    useJevState: () => harness.store.getSnapshot(),
    jev: harness.store,
  });
}

function chipButton(harness: Harness): ReactElement {
  const tree = renderChip(harness);
  return tree.children[1] as ReactElement;
}

test('the chip title follows the key state', async () => {
  const harness = harnessOf();
  await harness.store.refresh();
  const button = chipButton(harness);
  assert.equal(button.props.title, 'chip.title.withKey');
  const dot = button.children[0] as ReactElement;
  assert.equal(dot.props['data-state'], 'configured');
});

test('the chip avoids a key claim before the first read', () => {
  const harness = harnessOf();
  assert.equal(chipButton(harness).props.title, 'chip.title.unavailable');
});

test('the chip names the missing key after an empty read', async () => {
  const harness = harnessOf({
    describe: () =>
      Promise.resolve({
        ok: true,
        value: {
          [DEFAULT_REF]: { configured: false, writable: true },
        },
      } satisfies RemoteAnswer),
  });
  await harness.store.refresh();
  const button = chipButton(harness);
  assert.equal(button.props.title, 'chip.title.withoutKey');
  const dot = button.children[0] as ReactElement;
  assert.equal(dot.props['data-state'], 'missing');
});
