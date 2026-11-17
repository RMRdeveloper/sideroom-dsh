import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { JevSettings } from '@/config.js';
import type { JevTransport } from '@/jev/client.js';
import { createJev, type JevOptions } from '@/jev/index.js';
import {
  JEV_CUTOFF,
  JEV_GATE_CUTOFF,
  JEV_MODEL,
  type JevFileState,
  type JevPlanState,
  type JevRequestBody,
} from '@/jev/model.js';
import { JEV_STATUS } from '@/jev/state.js';

const AGENT = 'agent-1';
const APP = 'src/app.ts';

function fileStateOf(request: JevRequestBody | undefined): JevFileState {
  return request?.state as JevFileState;
}

function planStateOf(request: JevRequestBody | undefined): JevPlanState {
  return request?.state as JevPlanState;
}

function settings(overrides: Partial<JevSettings> = {}): JevSettings {
  return {
    enabled: true,
    keyEnv: 'TYPESAFE_API_KEY',
    endpoint: 'https://example.test/v1/systemone',
    model: JEV_MODEL,
    cutoff: JEV_CUTOFF,
    gate: JEV_GATE_CUTOFF,
    maxNotes: 3,
    timeoutMs: 50,
    maxRelatedFiles: 4,
    scanForConsumers: false,
    reviewPlans: true,
    reviewWorkflows: true,
    calibrate: false,
    ...overrides,
  };
}

function envelope(answers: Record<string, { noul: number }>): string {
  return JSON.stringify({ model: 'jev-1.14.0', answers });
}

interface TransportProbe {
  transport: JevTransport;
  requests: JevRequestBody[];
}

function transportReturning(body: unknown): TransportProbe {
  const requests: JevRequestBody[] = [];
  return {
    requests,
    transport: (request) => {
      requests.push(JSON.parse(request.body) as JevRequestBody);
      return Promise.resolve({
        status: 200,
        text: typeof body === 'string' ? body : JSON.stringify(body),
      });
    },
  };
}

function optionsWith({
  probe,
  settingsOverrides = {},
  files = { [APP]: 'export const total = 1;\n' },
  key = 'secret-key',
  readText,
  related,
}: {
  probe: TransportProbe;
  settingsOverrides?: Partial<JevSettings>;
  files?: Record<string, string>;
  key?: string;
  readText?: JevOptions['readText'];
  related?: JevOptions['related'];
}): JevOptions {
  return {
    settings: settings(settingsOverrides),
    resolveKey: () =>
      Promise.resolve(key === '' ? undefined : { key, origin: 'environment' }),
    readText:
      readText
      ?? (({ path }) => Promise.resolve(files[path])),
    related:
      related
      ?? (() => Promise.resolve({ files: [], partial: false })),
    transport: probe.transport,
  };
}

function observeMutation(
  jev: ReturnType<typeof createJev>,
  changes: Array<{ path: string; added: string[] }>,
  callId = 'call-1',
): void {
  jev.observe({ agentId: AGENT, callId, toolName: 'write', changes });
}

async function completeCall(
  jev: ReturnType<typeof createJev>,
  callId = 'call-1',
  succeeded = true,
): Promise<void> {
  await jev.complete({ agentId: AGENT, callId, cwd: '/repo', succeeded });
}

test('a disabled integration never calls the service', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(
    optionsWith({ probe, settingsOverrides: { enabled: false } }),
  );
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('without a key nothing is sent', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(optionsWith({ probe, key: '' }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
});

test('a successful mutation becomes a note', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'single-responsibility': { noul: 0.9 },
      'fail-fast': { noul: 0.2 },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['export const total = 1;'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.deepEqual(jev.notesFor(AGENT), [
    {
      path: APP,
      ruleId: 'single-responsibility',
      probability: 0.9,
      model: 'jev-1.14.0',
    },
  ]);
  const request = probe.requests[0];
  assert.equal(fileStateOf(request).file.path, APP);
  assert.equal(fileStateOf(request).file.body, 'export const total = 1;\n');
  assert.deepEqual(fileStateOf(request).change.addedLines, ['export const total = 1;']);
  assert.ok(request?.questions['would-reject'] !== undefined);
  assert.equal(probe.requests.length, 1);
});

test('a low global gate suppresses every note', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.1 },
      'single-responsibility': { noul: 0.99 },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('the cutoff drops a weak answer', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.79 },
    }),
  );
  const jev = createJev(optionsWith({ probe, settingsOverrides: { cutoff: 0.8 } }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('the session cap keeps the strongest notes', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.85 },
      'single-responsibility': { noul: 0.95 },
    }),
  );
  const jev = createJev(
    optionsWith({
      probe,
      settingsOverrides: { maxNotes: 1 },
      files: { 'src/a.ts': 'const a = 1;\n', 'src/b.ts': 'const b = 1;\n' },
    }),
  );
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [
    { path: 'src/a.ts', added: ['const a = 1;'] },
    { path: 'src/b.ts', added: ['const b = 1;'] },
  ]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(probe.requests.length, 2);
  assert.equal(jev.notesFor(AGENT).length, 1);
});

test('a failed mutation is not reviewed', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev, 'call-1', false);
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
});

test('a documentation file is never sent', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(
    optionsWith({
      probe,
      files: { 'README.md': '# title\n' },
    }),
  );
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: 'README.md', added: ['# title'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
});

test('a change that adds no lines is never sent', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: [] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
});

test('a failed request stays silent and trips the breaker', async () => {
  let calls = 0;
  const jev = createJev({
    settings: settings({ maxNotes: 3 }),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => {
      calls += 1;
      return Promise.resolve({ status: 500, text: 'boom' });
    },
  });
  for (let index = 0; index < 4; index += 1) {
    const callId = `call-${String(index)}`;
    jev.beginTurn(AGENT, index);
    observeMutation(jev, [{ path: APP, added: ['const a = 1;'] }], callId);
    await completeCall(jev, callId);
    await jev.drain(50);
  }
  assert.equal(calls, 3);
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('drain gives up after its budget', async () => {
  const jev = createJev({
    settings: settings({ timeoutMs: 20 }),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => new Promise(() => undefined),
  });
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['const a = 1;'] }]);
  await completeCall(jev);
  await jev.drain(10);
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('a note is deduplicated across requests in one turn', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.9 },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-1');
  await completeCall(jev, 'call-1');
  await jev.drain(50);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-2');
  await completeCall(jev, 'call-2');
  await jev.drain(50);
  assert.equal(probe.requests.length, 2);
  assert.equal(jev.notesFor(AGENT).length, 1);
});

test('related evidence travels with the request', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'dependency-direction': { noul: 0.9 },
    }),
  );
  const jev = createJev(
    optionsWith({
      probe,
      related: () =>
        Promise.resolve({
          files: [
            { path: 'src/db.ts', body: 'export const db = 1;', relation: 'imported' },
          ],
          partial: true,
        }),
    }),
  );
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['import { db } from \'./db\';'] }]);
  await completeCall(jev);
  await jev.drain(50);
  const request = probe.requests[0];
  assert.deepEqual(fileStateOf(request).context, {
    files: [
      { path: 'src/db.ts', body: 'export const db = 1;', relation: 'imported' },
    ],
    partial: true,
  });
  assert.ok(request?.questions['dependency-direction'] !== undefined);
});

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

test('the status reports the guard state', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const disabled = createJev(
    optionsWith({ probe, settingsOverrides: { enabled: false } }),
  );
  assert.equal(disabled.status(), JEV_STATUS.noKey);
  const jev = createJev(
    optionsWith({
      probe: {
        requests: [],
        transport: () => Promise.resolve({ status: 402, text: 'quota' }),
      },
    }),
  );
  assert.equal(jev.status(), JEV_STATUS.ready);
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(jev.status(), JEV_STATUS.quota);
});

test('drain returns immediately when the integration is disabled', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(
    optionsWith({ probe, settingsOverrides: { enabled: false } }),
  );
  await jev.drain(10_000);
  assert.equal(probe.requests.length, 0);
});

test('a completion without an observation sends nothing', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  await completeCall(jev, 'missing');
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
});

test('a request over the byte budget is skipped', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(
    optionsWith({
      probe,
      readText: () => Promise.resolve('x'.repeat(70_000)),
    }),
  );
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
});

test('an unreadable file is skipped and reported', async () => {
  const warnings = captureWarnings();
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(
    optionsWith({
      probe,
      readText: () => Promise.reject(new Error('read failed')),
    }),
  );
  try {
    jev.beginTurn(AGENT, 1);
    observeMutation(jev, [{ path: APP, added: ['x'] }]);
    await completeCall(jev);
    await jev.drain(50);
    assert.equal(probe.requests.length, 0);
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /read failed/);
});

test('a related-source failure still sends the request as partial', async () => {
  const warnings = captureWarnings();
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(
    optionsWith({
      probe,
      related: () => Promise.reject(new Error('related failed')),
    }),
  );
  try {
    jev.beginTurn(AGENT, 1);
    observeMutation(jev, [{ path: APP, added: ['x'] }]);
    await completeCall(jev);
    await jev.drain(50);
    assert.equal(fileStateOf(probe.requests[0]).context.partial, true);
    assert.deepEqual(fileStateOf(probe.requests[0]).context.files, []);
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /related failed/);
});

test('a quota failure stops further requests', async () => {
  let calls = 0;
  const jev = createJev({
    settings: settings(),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => {
      calls += 1;
      return Promise.resolve({ status: 402, text: 'quota' });
    },
  });
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-1');
  await completeCall(jev, 'call-1');
  await jev.drain(50);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-2');
  await completeCall(jev, 'call-2');
  await jev.drain(50);
  assert.equal(calls, 1);
});

test('a rate limit pauses until the next turn', async () => {
  let calls = 0;
  const jev = createJev({
    settings: settings(),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => {
      calls += 1;
      return Promise.resolve({ status: 429, text: 'slow down' });
    },
  });
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-1');
  await completeCall(jev, 'call-1');
  await jev.drain(50);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-2');
  await completeCall(jev, 'call-2');
  await jev.drain(50);
  assert.equal(calls, 1);
  jev.beginTurn(AGENT, 2);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-3');
  await completeCall(jev, 'call-3');
  await jev.drain(50);
  assert.equal(calls, 2);
});

test('cancelling drops the collected notes', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.9 },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  jev.cancel();
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('notes stay scoped to their agent', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.9 },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  jev.beginTurn('agent-2', 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.deepEqual(jev.notesFor('agent-2'), []);
  assert.equal(jev.notesFor(AGENT).length, 1);
});

test('an aborted request adds no note', async () => {
  let release: (() => void) | undefined;
  let signalStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const jev = createJev({
    settings: settings({ timeoutMs: 500 }),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => {
      signalStarted?.();
      return new Promise((resolve) => {
        release = () =>
          resolve({
            status: 200,
            text: envelope({
              'would-reject': { noul: 0.95 },
              'fail-fast': { noul: 0.9 },
            }),
          });
      });
    },
  });
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await started;
  jev.cancel();
  release?.();
  await jev.drain(200);
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('an envelope without a model still records the note', async () => {
  const probe = transportReturning(
    JSON.stringify({
      answers: {
        'would-reject': { noul: 0.95 },
        'fail-fast': { noul: 0.9 },
      },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.deepEqual(jev.notesFor(AGENT), [
    { path: APP, ruleId: 'fail-fast', probability: 0.9, model: undefined },
  ]);
});

test('a transient failure shows an unavailable status', async () => {
  const jev = createJev({
    settings: settings(),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => Promise.resolve({ status: 500, text: 'boom' }),
  });
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }]);
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(jev.status(), JEV_STATUS.unavailable);
});

test('a halted guard skips the queued review', async () => {
  let calls = 0;
  const jev = createJev({
    settings: settings(),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => {
      calls += 1;
      return Promise.resolve({ status: 402, text: 'quota' });
    },
  });
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [
    { path: 'src/a.ts', added: ['const a = 1;'] },
    { path: 'src/b.ts', added: ['const b = 1;'] },
  ]);
  await completeCall(jev);
  await jev.drain(100);
  assert.equal(calls, 1);
});

test('an observation without changes sends nothing', async () => {
  const probe = transportReturning(envelope({ 'would-reject': { noul: 0.9 } }));
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  jev.observe({
    agentId: AGENT,
    callId: 'call-1',
    toolName: 'write',
    changes: [],
  });
  await completeCall(jev);
  await jev.drain(50);
  assert.equal(probe.requests.length, 0);
});

const PLAN_ANSWER = JSON.stringify({
  model: 'jev-1.14.0',
  answers: {
    'would-reject': { noul: 0.95 },
    'plan-verification': { noul: 0.9 },
  },
});

test('a plan becomes an advisory note', async () => {
  const probe = transportReturning(PLAN_ANSWER);
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  const notes = await jev.reviewPlan({
    agentId: AGENT,
    cwd: '/repo',
    plan: '# Plan\n\nTouch src/app.ts.\n',
  });
  assert.deepEqual(notes, [
    {
      path: 'plan',
      ruleId: 'plan-verification',
      probability: 0.9,
      model: 'jev-1.14.0',
    },
  ]);
  assert.equal(probe.requests.length, 1);
  assert.deepEqual(planStateOf(probe.requests[0]).plan.mentionedFiles, [APP]);
});

test('the plan review reads the mentioned files as evidence', async () => {
  const probe = transportReturning(PLAN_ANSWER);
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  await jev.reviewPlan({
    agentId: AGENT,
    cwd: '/repo',
    plan: '# Plan\n\nTouch src/app.ts.\n',
  });
  assert.deepEqual(planStateOf(probe.requests[0]).files, [
    { path: APP, body: 'export const total = 1;\n' },
  ]);
});

test('a disabled plan review sends nothing', async () => {
  const probe = transportReturning(PLAN_ANSWER);
  const jev = createJev(
    optionsWith({ probe, settingsOverrides: { reviewPlans: false } }),
  );
  jev.beginTurn(AGENT, 1);
  assert.deepEqual(
    await jev.reviewPlan({ agentId: AGENT, cwd: '/repo', plan: '# Plan' }),
    [],
  );
  assert.equal(probe.requests.length, 0);
});

test('a failed plan review stays silent', async () => {
  const jev = createJev({
    settings: settings(),
    resolveKey: () => Promise.resolve({ key: 'secret', origin: 'environment' }),
    readText: () => Promise.resolve('const a = 1;\n'),
    related: () => Promise.resolve({ files: [], partial: false }),
    transport: () => Promise.resolve({ status: 500, text: 'boom' }),
  });
  jev.beginTurn(AGENT, 1);
  assert.deepEqual(
    await jev.reviewPlan({ agentId: AGENT, cwd: '/repo', plan: '# Plan' }),
    [],
  );
  assert.equal(jev.status(), JEV_STATUS.unavailable);
});

test('a plan note is deduplicated in the turn', async () => {
  const probe = transportReturning(PLAN_ANSWER);
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  const first = await jev.reviewPlan({
    agentId: AGENT,
    cwd: '/repo',
    plan: '# Plan\n\nTouch src/app.ts.\n',
  });
  const second = await jev.reviewPlan({
    agentId: AGENT,
    cwd: '/repo',
    plan: '# Plan\n\nTouch src/app.ts again.\n',
  });
  assert.equal(first.length, 1);
  assert.deepEqual(second, []);
});

test('a plan over the byte budget is not sent', async () => {
  const probe = transportReturning(PLAN_ANSWER);
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  const notes = await jev.reviewPlan({
    agentId: AGENT,
    cwd: '/repo',
    plan: `# Plan\n\n${'x'.repeat(70_000)}`,
  });
  assert.deepEqual(notes, []);
  assert.equal(probe.requests.length, 0);
});

test('an unreadable plan mention is skipped and reported', async () => {
  const warnings = captureWarnings();
  const probe = transportReturning(PLAN_ANSWER);
  const jev = createJev(
    optionsWith({
      probe,
      readText: () => Promise.reject(new Error('plan read failed')),
    }),
  );
  try {
    jev.beginTurn(AGENT, 1);
    await jev.reviewPlan({
      agentId: AGENT,
      cwd: '/repo',
      plan: '# Plan\n\nTouch src/app.ts.\n',
    });
    assert.equal(probe.requests.length, 1);
    assert.deepEqual(planStateOf(probe.requests[0]).files, []);
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /plan read failed/);
});

test('a mutation in a later turn counts as acceptance', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.9 },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-1');
  await completeCall(jev, 'call-1');
  await jev.drain(50);
  const delivered = jev.notesFor(AGENT);
  jev.recordDelivered(AGENT, delivered);
  jev.beginTurn(AGENT, 2);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-2');
  await completeCall(jev, 'call-2');
  await jev.drain(50);
  assert.equal(jev.metrics().rules['fail-fast']?.accepted, 1);
});

test('calibration mutes a rule nobody accepts', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.9 },
    }),
  );
  const jev = createJev(
    optionsWith({
      probe,
      settingsOverrides: { calibrate: true },
      readText: () => Promise.resolve('const a = 1;\n'),
    }),
  );
  for (let turn = 1; turn <= 10; turn += 1) {
    jev.beginTurn(AGENT, turn);
    observeMutation(
      jev,
      [{ path: `src/file${String(turn)}.ts`, added: ['x'] }],
      `call-${String(turn)}`,
    );
    await completeCall(jev, `call-${String(turn)}`);
    await jev.drain(50);
    jev.recordDelivered(AGENT, jev.notesFor(AGENT));
  }
  jev.beginTurn(AGENT, 11);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-11');
  await completeCall(jev, 'call-11');
  await jev.drain(50);
  assert.deepEqual(jev.notesFor(AGENT), []);
});

test('calibration keeps a rule the agent acts on', async () => {
  const probe = transportReturning(
    envelope({
      'would-reject': { noul: 0.95 },
      'fail-fast': { noul: 0.9 },
    }),
  );
  const jev = createJev(
    optionsWith({ probe, settingsOverrides: { calibrate: true } }),
  );
  for (let turn = 1; turn <= 10; turn += 1) {
    jev.beginTurn(AGENT, turn);
    observeMutation(jev, [{ path: APP, added: ['x'] }], `call-${String(turn)}`);
    await completeCall(jev, `call-${String(turn)}`);
    await jev.drain(50);
    jev.recordDelivered(AGENT, jev.notesFor(AGENT));
    jev.beginTurn(AGENT, turn + 1);
    observeMutation(jev, [{ path: APP, added: ['x'] }], `mut-${String(turn)}`);
    await completeCall(jev, `mut-${String(turn)}`);
    await jev.drain(50);
  }
  jev.beginTurn(AGENT, 20);
  observeMutation(jev, [{ path: APP, added: ['x'] }], 'call-20');
  await completeCall(jev, 'call-20');
  await jev.drain(50);
  assert.equal(jev.notesFor(AGENT).length, 1);
});

const QUESTIONNAIRE_ANSWER = JSON.stringify({
  model: 'jev-1.14.0',
  answers: {
    'would-reject': { noul: 0.95 },
    'questionnaire-bundled-decisions': { noul: 0.9 },
  },
});

const QUESTIONNAIRE_QUESTIONS = [
  {
    id: 'q1',
    header: undefined,
    text: 'Proceed?',
    options: [
      { label: 'Yes (Recommended)', description: undefined, recommended: true },
      { label: 'No', description: undefined, recommended: false },
    ],
    multiSelect: false,
  },
];

test('a questionnaire becomes an advisory note', async () => {
  const probe = transportReturning(QUESTIONNAIRE_ANSWER);
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  const notes = await jev.reviewQuestionnaire({
    agentId: AGENT,
    questions: QUESTIONNAIRE_QUESTIONS,
  });
  assert.deepEqual(notes, [
    {
      path: 'questionnaire',
      ruleId: 'questionnaire-bundled-decisions',
      probability: 0.9,
      model: 'jev-1.14.0',
    },
  ]);
  assert.equal(probe.requests.length, 1);
});

test('a disabled workflow review sends nothing', async () => {
  const probe = transportReturning(QUESTIONNAIRE_ANSWER);
  const jev = createJev(
    optionsWith({ probe, settingsOverrides: { reviewWorkflows: false } }),
  );
  jev.beginTurn(AGENT, 1);
  assert.deepEqual(
    await jev.reviewQuestionnaire({
      agentId: AGENT,
      questions: QUESTIONNAIRE_QUESTIONS,
    }),
    [],
  );
  assert.equal(probe.requests.length, 0);
});

test('a questionnaire note is deduplicated in the turn', async () => {
  const probe = transportReturning(QUESTIONNAIRE_ANSWER);
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  const first = await jev.reviewQuestionnaire({
    agentId: AGENT,
    questions: QUESTIONNAIRE_QUESTIONS,
  });
  const second = await jev.reviewQuestionnaire({
    agentId: AGENT,
    questions: QUESTIONNAIRE_QUESTIONS,
  });
  assert.equal(first.length, 1);
  assert.deepEqual(second, []);
});

test('a failed check with a completion claim becomes a note', async () => {
  const probe = transportReturning(
    JSON.stringify({
      model: 'jev-1.14.0',
      answers: {
        'would-reject': { noul: 0.95 },
        'todo-contradicts-check': { noul: 0.9 },
      },
    }),
  );
  const jev = createJev(optionsWith({ probe }));
  jev.beginTurn(AGENT, 1);
  const notes = await jev.reviewTodos({
    agentId: AGENT,
    items: ['Ship it'],
    check: { command: 'npm run check', status: 'failed' },
  });
  assert.deepEqual(notes, [
    {
      path: 'todos',
      ruleId: 'todo-contradicts-check',
      probability: 0.9,
      model: 'jev-1.14.0',
    },
  ]);
  assert.equal(probe.requests.length, 1);
});
