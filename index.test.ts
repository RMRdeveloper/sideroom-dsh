import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Context } from '@deepseek-ai/cordis';
import { apply } from '@/index.js';

type Listener = (...args: unknown[]) => unknown;

interface FakeContext {
  listeners: Map<string, Listener>;
  registeredTools: Map<
    string,
    { execute: (...args: unknown[]) => Promise<unknown> }
  >;
}

function fakeContext(): FakeContext {
  const listeners = new Map<string, Listener>();
  const registeredTools = new Map<
    string,
    { execute: (...args: unknown[]) => Promise<unknown> }
  >();
  const context = {
    listeners,
    registeredTools,
    effect: (callback: () => unknown) => {
      callback();
    },
    on: (event: string, handler: Listener) => {
      listeners.set(event, handler);
    },
    get: () => undefined,
    tools: {
      register: (definition: {
        name: string;
        execute: (...args: unknown[]) => Promise<unknown>;
      }) => {
        registeredTools.set(definition.name, definition);
        return () => undefined;
      },
    },
    systemPrompt: {
      section: () => () => undefined,
    },
  };
  return context;
}

function listenerFor(context: FakeContext, event: string): Listener {
  const listener = context.listeners.get(event);
  if (listener === undefined) {
    throw new Error(`missing listener ${event}`);
  }
  return listener;
}

const EXEC = {
  name: 'write',
  arguments: {
    file_path: 'src/app.ts',
    content: 'export const total = 1\n',
  },
  callId: 'call-1',
  agent: { id: 'agent-1' },
};

test('the gate, the rules and the turn-end review work together', async () => {
  const context = fakeContext();
  await apply(context as unknown as Context, {});

  await listenerFor(context, 'agent/pre-step')(
    { agent: { id: 'agent-1' }, turn: 1 },
    () => undefined,
  );

  const preExecute = listenerFor(context, 'tools/pre-execute');
  const denial = (await preExecute(EXEC, () => undefined)) as {
    kind: string;
    reason: string;
  };
  assert.equal(denial.kind, 'deny');
  assert.match(denial.reason, /sideroom_guidelines/);

  const guidelines = context.registeredTools.get('sideroom_guidelines');
  assert.ok(guidelines !== undefined);
  await guidelines.execute({ path: 'src/app.ts' }, EXEC);

  let allowed = false;
  const decision = await preExecute(EXEC, () => {
    allowed = true;
    return undefined;
  });
  assert.equal(decision, undefined);
  assert.equal(allowed, true);

  const postExecute = listenerFor(context, 'tools/post-execute');
  const accepted = await postExecute(
    EXEC,
    { isError: false, content: [] },
    () => Promise.resolve({ kind: 'accept' }),
  );
  assert.deepEqual(accepted, { kind: 'accept' });

  let steered: unknown;
  const agent = {
    id: 'agent-1',
    steer: (message: unknown) => {
      steered = message;
    },
  };
  await listenerFor(context, 'agent/turn-stopping')({
    agent,
    turn: 1,
    signal: new AbortController().signal,
  });

  const message = steered as {
    role: string;
    content: Array<{ type: string; text: string }>;
  };
  assert.equal(message.role, 'user');
  assert.match(message.content[0].text, /Sideroom review/);
});
