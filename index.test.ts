import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Context } from '@deepseek-ai/cordis';
import { apply, inject, name } from '@/index.js';

type Listener = (...args: unknown[]) => unknown;

interface RegisteredTool {
  name: string;
  execute(args: unknown, exec: unknown): Promise<unknown>;
}

interface Harness {
  context: Context;
  listeners: Map<string, Listener>;
  tools: Map<string, RegisteredTool>;
  sections: string[];
}

interface HarnessOptions {
  services?: Record<string, unknown>;
}

interface SkillsProbe {
  service: {
    register(skill: { name: string }): () => void;
    registerProvider(create: unknown): () => void;
  };
  registered: string[];
  providers: number;
}

interface ReviewMessage {
  content: Array<{ text: string }>;
}

interface ReviewAgent {
  id: string;
  steer(message: unknown): void;
}

const GUIDELINES_TOOL = 'sideroom_guidelines';
const APP_PATH = 'src/app.ts';
const CHECK_COMMAND = 'npm run check';
const AGENT_ID = 'agent-1';
const SESSION = { id: 'session-1' };

const WRITE_EXEC = {
  name: 'write',
  arguments: { file_path: APP_PATH, content: 'export const total = 1\n' },
  callId: 'write-1',
  agent: { id: AGENT_ID, session: SESSION },
};

const NOTE_EXEC = {
  name: 'write',
  arguments: { file_path: APP_PATH, content: 'const data = getRows();\n' },
  callId: 'note-1',
  agent: { id: AGENT_ID, session: SESSION },
};

const SHELL_EXEC = {
  name: 'bash',
  arguments: { command: CHECK_COMMAND },
  callId: 'shell-1',
  agent: { id: AGENT_ID, session: SESSION },
};

function createSkillsProbe(): SkillsProbe {
  const probe: SkillsProbe = {
    service: {
      register: (skill) => {
        probe.registered.push(skill.name);
        return () => undefined;
      },
      registerProvider: () => {
        probe.providers += 1;
        return () => undefined;
      },
    },
    registered: [],
    providers: 0,
  };
  return probe;
}

function createHarness({ services }: HarnessOptions = {}): Harness {
  const listeners = new Map<string, Listener>();
  const tools = new Map<string, RegisteredTool>();
  const sections: string[] = [];
  const context = {
    effect: (callback: () => unknown) => {
      callback();
      return () => undefined;
    },
    on: (event: string, handler: Listener) => {
      listeners.set(event, handler);
      return () => undefined;
    },
    get: (service: string) => services?.[service],
    tools: {
      register: (definition: RegisteredTool) => {
        tools.set(definition.name, definition);
        return () => undefined;
      },
    },
    systemPrompt: {
      section: (section: { name: string }) => {
        sections.push(section.name);
        return () => undefined;
      },
    },
  };
  return {
    context: context as unknown as Context,
    listeners,
    tools,
    sections,
  };
}

function listenerFor(harness: Harness, event: string): Listener {
  const listener = harness.listeners.get(event);
  if (listener === undefined) {
    throw new Error(`missing listener ${event}`);
  }
  return listener;
}

function guidelinesTool(harness: Harness): RegisteredTool {
  const tool = harness.tools.get(GUIDELINES_TOOL);
  if (tool === undefined) {
    throw new Error('missing guidelines tool');
  }
  return tool;
}

function captureWarnings(): { messages: unknown[]; restore(): void } {
  const messages: unknown[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    messages.push(...args);
  };
  return {
    messages,
    restore: () => {
      console.warn = original;
    },
  };
}

function createCheckDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'sideroom-checks-'));
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }),
  );
  return directory;
}

function workingDirectoryService(directory: string): { get(): string } {
  return { get: () => directory };
}

function captureSteer(): { agent: ReviewAgent; messages: unknown[] } {
  const messages: unknown[] = [];
  return {
    messages,
    agent: {
      id: AGENT_ID,
      steer: (message: unknown) => {
        messages.push(message);
      },
    },
  };
}

async function armReview(harness: Harness): Promise<void> {
  const preStep = listenerFor(harness, 'agent/pre-step');
  const preExecute = listenerFor(harness, 'tools/pre-execute');
  const postExecute = listenerFor(harness, 'tools/post-execute');
  preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
  await guidelinesTool(harness).execute({ path: APP_PATH }, WRITE_EXEC);
  await preExecute(WRITE_EXEC, () => undefined);
  await postExecute(WRITE_EXEC, { isError: false, content: [] }, () =>
    Promise.resolve({ kind: 'accept' }),
  );
}

interface WritableFileSystem {
  resolve(path: string, options?: { cwd?: string }): Promise<{ targetKey: string }>;
  stat(): Promise<{ type: string } | undefined>;
  readText(target: { targetKey: string }): Promise<string>;
}

function writableFileSystem(content: string): WritableFileSystem {
  let stats = 0;
  return {
    resolve: (path) => Promise.resolve({ targetKey: path }),
    stat: () => {
      stats += 1;
      return Promise.resolve(stats === 1 ? undefined : { type: 'file' });
    },
    readText: () => Promise.resolve(content),
  };
}

interface FetchProbe {
  calls: number;
  bodies: string[];
  restore(): void;
}

function stubFetch(body: string, status = 200): FetchProbe {
  const original = globalThis.fetch;
  const probe: FetchProbe = {
    calls: 0,
    bodies: [],
    restore: () => {
      globalThis.fetch = original;
    },
  };
  globalThis.fetch = (
    _input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    probe.calls += 1;
    probe.bodies.push(typeof init?.body === 'string' ? init.body : '');
    return Promise.resolve(new Response(body, { status }));
  };
  return probe;
}

function withApiKey(key: string | undefined): () => void {
  const original = process.env.TYPESAFE_API_KEY;
  if (key === undefined) {
    delete process.env.TYPESAFE_API_KEY;
  } else {
    process.env.TYPESAFE_API_KEY = key;
  }
  return () => {
    if (original === undefined) {
      delete process.env.TYPESAFE_API_KEY;
    } else {
      process.env.TYPESAFE_API_KEY = original;
    }
  };
}

const JEV_FILE_CONTENT = 'export const total = 1\n';
const JEV_ANSWER = JSON.stringify({
  model: 'jev-1.14.0',
  answers: {
    'would-reject': { noul: 0.95 },
    'single-responsibility': { noul: 0.9 },
  },
});

test('the bundle exports its name and injected services', () => {
  assert.equal(name, 'sideroom-dsh');
  assert.deepEqual(inject, ['tools', 'systemPrompt']);
});

test('an unknown section is reported as a warning', async () => {
  const warnings = captureWarnings();
  try {
    const harness = createHarness();
    await apply(harness.context, { unknown: true });
  } finally {
    warnings.restore();
  }
  assert.deepEqual(warnings.messages, [
    'sideroom-dsh: config.unknown is not a known section',
  ]);
});

test('apply registers the guidelines tool and both prompt sections', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  assert.ok(harness.tools.has(GUIDELINES_TOOL));
  assert.deepEqual(harness.sections, ['sideroom.contract', 'sideroom.explain']);
});

test('the prompt sections follow the settings', async () => {
  const harness = createHarness();
  await apply(harness.context, { prompt: { contract: false, explain: false } });
  assert.deepEqual(harness.sections, []);
});

test('the packaged skills and the monorepo provider are registered', async () => {
  const probe = createSkillsProbe();
  const harness = createHarness({ services: { skills: probe.service } });
  await apply(harness.context, {});
  assert.ok(probe.registered.includes('sideroom-guidelines'));
  assert.equal(probe.providers, 1);
});

test('skills stay off when disabled', async () => {
  const probe = createSkillsProbe();
  const harness = createHarness({ services: { skills: probe.service } });
  await apply(harness.context, { skills: { enabled: false } });
  assert.deepEqual(probe.registered, []);
  assert.equal(probe.providers, 0);
});

test('skills stay off without a skills service', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  assert.ok(harness.tools.has(GUIDELINES_TOOL));
});

test('packaged and monorepo registration are independent', async () => {
  const probe = createSkillsProbe();
  const harness = createHarness({ services: { skills: probe.service } });
  await apply(harness.context, { skills: { packaged: false, monorepo: false } });
  assert.deepEqual(probe.registered, []);
  assert.equal(probe.providers, 0);
});

test('a new turn clears the loaded guides', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const preStep = listenerFor(harness, 'agent/pre-step');
  const preExecute = listenerFor(harness, 'tools/pre-execute');
  const guidelines = guidelinesTool(harness);

  preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
  const loaded = (await guidelines.execute({ path: APP_PATH }, WRITE_EXEC)) as {
    language: string;
  };
  assert.equal(loaded.language, 'typescript');
  assert.equal(await preExecute(WRITE_EXEC, () => undefined), undefined);

  preStep({ agent: { id: AGENT_ID }, turn: 2 }, () => undefined);
  const denial = (await preExecute(WRITE_EXEC, () => undefined)) as {
    kind: string;
  };
  assert.equal(denial.kind, 'deny');
});

test('a pre-step without an agent still continues', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const preStep = listenerFor(harness, 'agent/pre-step');
  let continued = false;
  const returned = preStep({}, () => {
    continued = true;
    return 'next';
  });
  assert.equal(returned, 'next');
  assert.equal(continued, true);
});

test('a new turn drops the pending notes', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const preStep = listenerFor(harness, 'agent/pre-step');
  const preExecute = listenerFor(harness, 'tools/pre-execute');
  const postExecute = listenerFor(harness, 'tools/post-execute');

  preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
  await guidelinesTool(harness).execute({ path: APP_PATH }, NOTE_EXEC);
  await preExecute(NOTE_EXEC, () => undefined);
  preStep({ agent: { id: AGENT_ID }, turn: 2 }, () => undefined);

  const decision = { kind: 'accept' };
  const returned = await postExecute(
    NOTE_EXEC,
    { isError: false, content: [] },
    () => Promise.resolve(decision),
  );
  assert.deepEqual(returned, decision);
});

test('pending notes are appended to an accepted result', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const preStep = listenerFor(harness, 'agent/pre-step');
  const preExecute = listenerFor(harness, 'tools/pre-execute');
  const postExecute = listenerFor(harness, 'tools/post-execute');

  preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
  await guidelinesTool(harness).execute({ path: APP_PATH }, NOTE_EXEC);
  await preExecute(NOTE_EXEC, () => undefined);
  const decision = { kind: 'accept' };
  const augmented = (await postExecute(
    NOTE_EXEC,
    { isError: false, content: [] },
    () => Promise.resolve(decision),
  )) as { kind: string; content: Array<{ text: string }> };
  assert.equal(augmented.kind, 'accept');
  assert.equal(augmented.content.length, 1);
  assert.match(augmented.content[0].text, /Sideroom notes for src\/app\.ts/);
  assert.match(augmented.content[0].text, /rule 6 Clear names/);

  const again = await postExecute(
    NOTE_EXEC,
    { isError: false, content: [] },
    () => Promise.resolve(decision),
  );
  assert.deepEqual(again, decision);
});

test('a failed mutation gets no notes', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const preStep = listenerFor(harness, 'agent/pre-step');
  const preExecute = listenerFor(harness, 'tools/pre-execute');
  const postExecute = listenerFor(harness, 'tools/post-execute');
  const failing = { ...NOTE_EXEC, callId: 'failing-1' };

  preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
  await guidelinesTool(harness).execute({ path: APP_PATH }, failing);
  await preExecute(failing, () => undefined);
  const decision = { kind: 'accept' };
  const returned = await postExecute(
    failing,
    { isError: true, content: [] },
    () => Promise.resolve(decision),
  );
  assert.deepEqual(returned, decision);
});

test('a non-accepted decision is returned untouched', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const postExecute = listenerFor(harness, 'tools/post-execute');
  const denial = { kind: 'deny', reason: 'not allowed' };
  assert.equal(
    await postExecute(WRITE_EXEC, { isError: false, content: [] }, () =>
      Promise.resolve(denial),
    ),
    denial,
  );
  const valued = { kind: 'accept', value: { changed: true } };
  assert.equal(
    await postExecute(WRITE_EXEC, { isError: false, content: [] }, () =>
      Promise.resolve(valued),
    ),
    valued,
  );
});

test('notes append after the decision content', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const preStep = listenerFor(harness, 'agent/pre-step');
  const preExecute = listenerFor(harness, 'tools/pre-execute');
  const postExecute = listenerFor(harness, 'tools/post-execute');
  const located = { ...NOTE_EXEC, callId: 'content-1' };

  preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
  await guidelinesTool(harness).execute({ path: APP_PATH }, located);
  await preExecute(located, () => undefined);
  const augmented = (await postExecute(
    located,
    {
      isError: false,
      content: [{ type: 'text', text: 'from the result' }],
    },
    () =>
      Promise.resolve({
        kind: 'accept',
        content: [{ type: 'text', text: 'from the decision' }],
      }),
  )) as { content: Array<{ text: string }> };
  assert.equal(augmented.content.length, 2);
  assert.equal(augmented.content[0].text, 'from the decision');
  assert.match(augmented.content[1].text, /Sideroom notes for src\/app\.ts/);
});

test('notes fall back to the result content', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const preStep = listenerFor(harness, 'agent/pre-step');
  const preExecute = listenerFor(harness, 'tools/pre-execute');
  const postExecute = listenerFor(harness, 'tools/post-execute');
  const located = { ...NOTE_EXEC, callId: 'fallback-1' };

  preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
  await guidelinesTool(harness).execute({ path: APP_PATH }, located);
  await preExecute(located, () => undefined);
  const augmented = (await postExecute(
    located,
    {
      isError: false,
      content: [{ type: 'text', text: 'from the result' }],
    },
    () => Promise.resolve({ kind: 'accept' }),
  )) as { content: Array<{ text: string }> };
  assert.equal(augmented.content.length, 2);
  assert.equal(augmented.content[0].text, 'from the result');
});

test('a broken inspection is reported and the call continues', async () => {
  const warnings = captureWarnings();
  try {
    const harness = createHarness();
    await apply(harness.context, {});
    const preExecute = listenerFor(harness, 'tools/pre-execute');
    const broken = {
      name: 'write',
      arguments: { file_path: APP_PATH, content: 'x' },
      agent: { id: AGENT_ID },
      get callId(): string {
        throw new Error('missing call id');
      },
    };
    const returned = await preExecute(broken, () => 'next');
    assert.equal(returned, 'next');
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /missing call id/);
});

test('a green check run is reused in the review', async () => {
  const directory = createCheckDirectory();
  try {
    const harness = createHarness({
      services: { workingDirectory: workingDirectoryService(directory) },
    });
    await apply(harness.context, {});
    const preStep = listenerFor(harness, 'agent/pre-step');
    const preExecute = listenerFor(harness, 'tools/pre-execute');
    const postExecute = listenerFor(harness, 'tools/post-execute');
    const accept = (): Promise<{ kind: string }> =>
      Promise.resolve({ kind: 'accept' });

    preStep({ agent: SHELL_EXEC.agent, turn: 1 }, () => undefined);
    await guidelinesTool(harness).execute({ path: APP_PATH }, SHELL_EXEC);
    await preExecute(SHELL_EXEC, () => undefined);
    await postExecute(SHELL_EXEC, { isError: false, content: [] }, accept);
    const mutationExec = { ...WRITE_EXEC, agent: SHELL_EXEC.agent };
    await preExecute(mutationExec, () => undefined);
    await postExecute(mutationExec, { isError: false, content: [] }, accept);
    const secondCheck = { ...SHELL_EXEC, callId: 'shell-2' };
    await preExecute(secondCheck, () => undefined);
    await postExecute(secondCheck, { isError: false, content: [] }, accept);

    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    assert.equal(steer.messages.length, 1);
    const message = steer.messages[0] as ReviewMessage;
    assert.match(
      message.content[0].text,
      /Checks already green this run: `npm run check`/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a failed check run is reported as detected', async () => {
  const directory = createCheckDirectory();
  try {
    const harness = createHarness({
      services: { workingDirectory: workingDirectoryService(directory) },
    });
    await apply(harness.context, {});
    const preStep = listenerFor(harness, 'agent/pre-step');
    const preExecute = listenerFor(harness, 'tools/pre-execute');
    const postExecute = listenerFor(harness, 'tools/post-execute');
    const accept = (): Promise<{ kind: string }> =>
      Promise.resolve({ kind: 'accept' });

    preStep({ agent: SHELL_EXEC.agent, turn: 1 }, () => undefined);
    await guidelinesTool(harness).execute({ path: APP_PATH }, SHELL_EXEC);
    await preExecute(SHELL_EXEC, () => undefined);
    await postExecute(SHELL_EXEC, { isError: true, content: [] }, accept);
    const mutationExec = { ...WRITE_EXEC, agent: SHELL_EXEC.agent };
    await preExecute(mutationExec, () => undefined);
    await postExecute(mutationExec, { isError: false, content: [] }, accept);

    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    const message = steer.messages[0] as ReviewMessage;
    assert.match(
      message.content[0].text,
      /Detected check command: `npm run check`/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a turn without a mutation sends no review', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  const steer = captureSteer();
  await listenerFor(harness, 'agent/turn-stopping')({
    agent: steer.agent,
    turn: 1,
    signal: new AbortController().signal,
  });
  assert.equal(steer.messages.length, 0);
});

test('an aborted turn sends no review', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  await armReview(harness);
  const controller = new AbortController();
  controller.abort();
  const steer = captureSteer();
  await listenerFor(harness, 'agent/turn-stopping')({
    agent: steer.agent,
    turn: 1,
    signal: controller.signal,
  });
  assert.equal(steer.messages.length, 0);
});

test('the review is sent only once per turn', async () => {
  const harness = createHarness();
  await apply(harness.context, {});
  await armReview(harness);
  const steer = captureSteer();
  const turnStopping = listenerFor(harness, 'agent/turn-stopping');
  const payload = {
    agent: steer.agent,
    turn: 1,
    signal: new AbortController().signal,
  };
  await turnStopping(payload);
  await turnStopping(payload);
  assert.equal(steer.messages.length, 1);
});

test('a failing steer is reported instead of crashing', async () => {
  const warnings = captureWarnings();
  try {
    const harness = createHarness();
    await apply(harness.context, {});
    await armReview(harness);
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: {
        id: AGENT_ID,
        steer: () => {
          throw new Error('offline');
        },
      },
      turn: 1,
      signal: new AbortController().signal,
    });
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /sideroom-dsh: offline/);
});

test('a Jev note rides the review of the turn', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(JEV_ANSWER);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    await armReview(harness);
    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    assert.equal(probe.calls, 1);
    assert.match(probe.bodies[0] ?? '', /export const total = 1/);
    assert.equal(steer.messages.length, 1);
    const message = steer.messages[0] as ReviewMessage;
    assert.match(message.content[0].text, /Sideroom Jev review \(model jev-1\.14\.0/);
    assert.match(
      message.content[0].text,
      /`src\/app\.ts` \[single-responsibility\] p=0\.90/,
    );
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('Jev stays silent without a key', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey(undefined);
  const probe = stubFetch(JEV_ANSWER);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    await armReview(harness);
    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    assert.equal(probe.calls, 0);
    const message = steer.messages[0] as ReviewMessage;
    assert.doesNotMatch(message.content[0].text, /Sideroom Jev review/);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a Jev gate rejection leaves the review without notes', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(
    JSON.stringify({
      answers: {
        'would-reject': { noul: 0.1 },
        'single-responsibility': { noul: 0.99 },
      },
    }),
  );
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    await armReview(harness);
    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    assert.equal(probe.calls, 1);
    const message = steer.messages[0] as ReviewMessage;
    assert.doesNotMatch(message.content[0].text, /Sideroom Jev review/);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a failing Jev request does not break the review', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch('boom', 500);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    await armReview(harness);
    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    assert.equal(probe.calls, 1);
    assert.equal(steer.messages.length, 1);
    const message = steer.messages[0] as ReviewMessage;
    assert.match(message.content[0].text, /Sideroom review/);
    assert.doesNotMatch(message.content[0].text, /Sideroom Jev review/);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a disabled review leaves Jev off even when it is enabled', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(JEV_ANSWER);
  try {
    await apply(harness.context, {
      review: { enabled: false },
      jev: { enabled: true, timeoutMs: 200 },
    });
    await armReview(harness);
    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    assert.equal(probe.calls, 0);
    assert.equal(steer.messages.length, 0);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a failed mutation is not sent to Jev', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(JEV_ANSWER);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    const preStep = listenerFor(harness, 'agent/pre-step');
    const preExecute = listenerFor(harness, 'tools/pre-execute');
    const postExecute = listenerFor(harness, 'tools/post-execute');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    await guidelinesTool(harness).execute({ path: APP_PATH }, WRITE_EXEC);
    await preExecute(WRITE_EXEC, () => undefined);
    await postExecute(WRITE_EXEC, { isError: true, content: [] }, () =>
      Promise.resolve({ kind: 'accept' }),
    );
    assert.equal(probe.calls, 0);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a shell call does not reach Jev', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(JEV_ANSWER);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    const preStep = listenerFor(harness, 'agent/pre-step');
    const preExecute = listenerFor(harness, 'tools/pre-execute');
    const postExecute = listenerFor(harness, 'tools/post-execute');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    await preExecute(SHELL_EXEC, () => undefined);
    await postExecute(SHELL_EXEC, { isError: false, content: [] }, () =>
      Promise.resolve({ kind: 'accept' }),
    );
    assert.equal(probe.calls, 0);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('the note cap holds through the review', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(
    JSON.stringify({
      model: 'jev-1.14.0',
      answers: {
        'would-reject': { noul: 0.95 },
        'single-responsibility': { noul: 0.9 },
        'fail-fast': { noul: 0.85 },
      },
    }),
  );
  try {
    await apply(harness.context, {
      jev: { enabled: true, timeoutMs: 200, maxNotes: 1 },
    });
    await armReview(harness);
    const steer = captureSteer();
    await listenerFor(harness, 'agent/turn-stopping')({
      agent: steer.agent,
      turn: 1,
      signal: new AbortController().signal,
    });
    const message = steer.messages[0] as ReviewMessage;
    const lines = message.content[0].text.match(/^- `src\/app\.ts`/gmu) ?? [];
    assert.equal(lines.length, 1);
  } finally {
    probe.restore();
    restoreKey();
  }
});

const PLAN_EXEC = {
  name: 'exit_plan_mode',
  arguments: { plan: '# Plan\n\nUpdate the total.\n' },
  callId: 'plan-1',
  agent: { id: AGENT_ID, session: SESSION },
};

const PLAN_ANSWER = JSON.stringify({
  model: 'jev-1.14.0',
  answers: {
    'would-reject': { noul: 0.95 },
    'plan-verification': { noul: 0.9 },
  },
});

test('a plan note is appended to the exit result', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(PLAN_ANSWER);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    const preStep = listenerFor(harness, 'agent/pre-step');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    const augmented = (await listenerFor(harness, 'tools/post-execute')(
      PLAN_EXEC,
      { isError: false, content: [] },
      () => Promise.resolve({ kind: 'accept' }),
    )) as { kind: string; content?: Array<{ text: string }> };
    assert.equal(probe.calls, 1);
    assert.equal(augmented.kind, 'accept');
    assert.match(
      augmented.content?.[0]?.text ?? '',
      /Sideroom Jev plan review/,
    );
    assert.match(augmented.content?.[0]?.text ?? '', /plan-verification/);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a disabled Jev leaves the plan result untouched', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(PLAN_ANSWER);
  try {
    await apply(harness.context, {});
    const preStep = listenerFor(harness, 'agent/pre-step');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    const decision = { kind: 'accept' };
    const returned = await listenerFor(harness, 'tools/post-execute')(
      PLAN_EXEC,
      { isError: false, content: [] },
      () => Promise.resolve(decision),
    );
    assert.deepEqual(returned, decision);
    assert.equal(probe.calls, 0);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a plan review failure leaves the result untouched', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch('boom', 500);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    const preStep = listenerFor(harness, 'agent/pre-step');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    const decision = { kind: 'accept' };
    const returned = await listenerFor(harness, 'tools/post-execute')(
      PLAN_EXEC,
      { isError: false, content: [] },
      () => Promise.resolve(decision),
    );
    assert.deepEqual(returned, decision);
    assert.equal(probe.calls, 1);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a blank plan is not reviewed', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(PLAN_ANSWER);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    const preStep = listenerFor(harness, 'agent/pre-step');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    const blank = { ...PLAN_EXEC, arguments: { plan: '   ' } };
    const decision = { kind: 'accept' };
    const returned = await listenerFor(harness, 'tools/post-execute')(
      blank,
      { isError: false, content: [] },
      () => Promise.resolve(decision),
    );
    assert.deepEqual(returned, decision);
    assert.equal(probe.calls, 0);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('the plan review survives a disabled code review', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(PLAN_ANSWER);
  try {
    await apply(harness.context, {
      review: { enabled: false },
      jev: { enabled: true, timeoutMs: 200 },
    });
    const preStep = listenerFor(harness, 'agent/pre-step');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    const augmented = (await listenerFor(harness, 'tools/post-execute')(
      PLAN_EXEC,
      { isError: false, content: [] },
      () => Promise.resolve({ kind: 'accept' }),
    )) as { content?: Array<{ text: string }> };
    assert.equal(probe.calls, 1);
    assert.match(augmented.content?.[0]?.text ?? '', /Jev plan review/);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a mutation is not sent to Jev when the code review is disabled', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(JEV_ANSWER);
  try {
    await apply(harness.context, {
      review: { enabled: false },
      jev: { enabled: true, timeoutMs: 200 },
    });
    const preStep = listenerFor(harness, 'agent/pre-step');
    const preExecute = listenerFor(harness, 'tools/pre-execute');
    const postExecute = listenerFor(harness, 'tools/post-execute');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    await guidelinesTool(harness).execute({ path: APP_PATH }, WRITE_EXEC);
    await preExecute(WRITE_EXEC, () => undefined);
    await postExecute(WRITE_EXEC, { isError: false, content: [] }, () =>
      Promise.resolve({ kind: 'accept' }),
    );
    assert.equal(probe.calls, 0);
  } finally {
    probe.restore();
    restoreKey();
  }
});

const ASK_EXEC = {
  name: 'ask_user_question',
  arguments: {
    questions: [
      {
        id: 'q1',
        question: 'Proceed?',
        options: [{ label: 'Yes (Recommended)' }, { label: 'No' }],
      },
    ],
  },
  callId: 'ask-1',
  agent: { id: AGENT_ID, session: SESSION },
};

const ASK_ANSWER = JSON.stringify({
  model: 'jev-1.14.0',
  answers: {
    'would-reject': { noul: 0.95 },
    'questionnaire-bundled-decisions': { noul: 0.9 },
  },
});

test('a questionnaire note is appended to the answer result', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch(ASK_ANSWER);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    const preStep = listenerFor(harness, 'agent/pre-step');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    const augmented = (await listenerFor(harness, 'tools/post-execute')(
      ASK_EXEC,
      { isError: false, content: [] },
      () => Promise.resolve({ kind: 'accept' }),
    )) as { content?: Array<{ text: string }> };
    assert.equal(probe.calls, 1);
    assert.match(
      augmented.content?.[0]?.text ?? '',
      /Jev questionnaire review/,
    );
    assert.match(
      augmented.content?.[0]?.text ?? '',
      /questionnaire-bundled-decisions/,
    );
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a failed questionnaire review leaves the result untouched', async () => {
  const harness = createHarness({
    services: {
      fs: writableFileSystem(JEV_FILE_CONTENT),
      workingDirectory: workingDirectoryService('/repo'),
    },
  });
  const restoreKey = withApiKey('test-key');
  const probe = stubFetch('boom', 500);
  try {
    await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
    const preStep = listenerFor(harness, 'agent/pre-step');
    preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
    const decision = { kind: 'accept' };
    const returned = await listenerFor(harness, 'tools/post-execute')(
      ASK_EXEC,
      { isError: false, content: [] },
      () => Promise.resolve(decision),
    );
    assert.deepEqual(returned, decision);
    assert.equal(probe.calls, 1);
  } finally {
    probe.restore();
    restoreKey();
  }
});

test('a failed check with a completion claim gets a task note', async () => {
  const directory = createCheckDirectory();
  try {
    const harness = createHarness({
      services: {
        fs: writableFileSystem(JEV_FILE_CONTENT),
        workingDirectory: workingDirectoryService(directory),
      },
    });
    const restoreKey = withApiKey('test-key');
    const probe = stubFetch(
      JSON.stringify({
        model: 'jev-1.14.0',
        answers: {
          'would-reject': { noul: 0.95 },
          'todo-contradicts-check': { noul: 0.9 },
        },
      }),
    );
    try {
      await apply(harness.context, { jev: { enabled: true, timeoutMs: 200 } });
      const preStep = listenerFor(harness, 'agent/pre-step');
      const preExecute = listenerFor(harness, 'tools/pre-execute');
      const postExecute = listenerFor(harness, 'tools/post-execute');
      preStep({ agent: { id: AGENT_ID }, turn: 1 }, () => undefined);
      const failedShell = { ...SHELL_EXEC, callId: 'shell-fail' };
      await preExecute(failedShell, () => undefined);
      await postExecute(failedShell, { isError: true, content: [] }, () =>
        Promise.resolve({ kind: 'accept' }),
      );
      const todoExec = {
        name: 'todo_write',
        arguments: {
          todos: [{ content: 'Ship it', status: 'completed' }],
        },
        callId: 'todo-1',
        agent: { id: AGENT_ID, session: SESSION },
      };
      const augmented = (await postExecute(
        todoExec,
        { isError: false, content: [] },
        () => Promise.resolve({ kind: 'accept' }),
      )) as { content?: Array<{ text: string }> };
      assert.equal(probe.calls, 1);
      assert.match(augmented.content?.[0]?.text ?? '', /Jev task review/);
    } finally {
      probe.restore();
      restoreKey();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
