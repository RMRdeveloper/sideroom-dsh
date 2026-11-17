import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  askJevRequest,
  classifyStatus,
  createFetchTransport,
  JEV_FAILURE,
  type JevTransport,
} from '@/jev/client.js';
import { buildFileState, buildRequestBody } from '@/jev/model.js';

function request(): ReturnType<typeof buildRequestBody> {
  return buildRequestBody(
    buildFileState({
      path: 'src/app.ts',
      body: 'export const total = 1;\n',
      kind: 'write',
      addedLines: ['export const total = 1;'],
    }),
    'jev-latest',
  );
}

function transportReturning(
  response: { status: number; text: string },
): JevTransport {
  return () => Promise.resolve(response);
}

const OK_BODY = JSON.stringify({
  model: 'jev-1.14.0',
  answers: {
    'would-reject': { noul: 0.93 },
    'fail-fast': { noul: 0.88 },
    'single-responsibility': { noul: 0.2 },
  },
});

test('HTTP statuses map to their failure classes', () => {
  assert.equal(classifyStatus(401), JEV_FAILURE.auth);
  assert.equal(classifyStatus(403), JEV_FAILURE.auth);
  assert.equal(classifyStatus(402), JEV_FAILURE.quota);
  assert.equal(classifyStatus(429), JEV_FAILURE.rateLimited);
  assert.equal(classifyStatus(400), JEV_FAILURE.transient);
  assert.equal(classifyStatus(500), JEV_FAILURE.transient);
  assert.equal(classifyStatus(200), undefined);
});

test('a successful answer becomes findings above the cutoff', async () => {
  const attempt = await askJevRequest({
    transport: transportReturning({ status: 200, text: OK_BODY }),
    apiKey: 'key',
    requestBody: request(),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.deepEqual(attempt.findings, [
    { ruleId: 'fail-fast', probability: 0.88 },
  ]);
  assert.equal(attempt.model, 'jev-1.14.0');
  assert.equal(attempt.failure, undefined);
});

test('a low gate answer yields no findings', async () => {
  const attempt = await askJevRequest({
    transport: transportReturning({
      status: 200,
      text: JSON.stringify({
        answers: {
          'would-reject': { noul: 0.1 },
          'fail-fast': { noul: 0.99 },
        },
      }),
    }),
    apiKey: 'key',
    requestBody: request(),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.deepEqual(attempt.findings, []);
  assert.equal(attempt.failure, undefined);
});

test('an HTTP failure is classified and carries no findings', async () => {
  const attempt = await askJevRequest({
    transport: transportReturning({ status: 402, text: 'quota' }),
    apiKey: 'key',
    requestBody: request(),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.equal(attempt.failure, JEV_FAILURE.quota);
  assert.equal(attempt.findings, undefined);
});

test('an unparseable body is a transient failure', async () => {
  const attempt = await askJevRequest({
    transport: transportReturning({ status: 200, text: 'not json' }),
    apiKey: 'key',
    requestBody: request(),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.equal(attempt.failure, JEV_FAILURE.transient);
  assert.equal(attempt.findings, undefined);
});

test('a transport rejection is a transient failure', async () => {
  const attempt = await askJevRequest({
    transport: () => Promise.reject(new Error('offline')),
    apiKey: 'key',
    requestBody: request(),
    cutoff: 0.8,
    gate: 0.6,
  });
  assert.equal(attempt.failure, JEV_FAILURE.transient);
});

test('an aborted request is reported as cancelled', async () => {
  const controller = new AbortController();
  controller.abort();
  const attempt = await askJevRequest({
    transport: () => Promise.reject(new Error('aborted')),
    apiKey: 'key',
    requestBody: request(),
    cutoff: 0.8,
    gate: 0.6,
    signal: controller.signal,
  });
  assert.equal(attempt.failure, JEV_FAILURE.cancelled);
});

test('the fetch transport posts the key and the body to the endpoint', async () => {
  const original = globalThis.fetch;
  const captured: { url?: string; request?: RequestInit } = {};
  globalThis.fetch = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    captured.url = input instanceof URL ? input.href : input instanceof Request ? input.url : input;
    captured.request = init;
    return Promise.resolve(new Response(OK_BODY, { status: 200 }));
  };
  try {
    const transport = createFetchTransport({
      endpoint: 'https://api.example.test/v1/systemone',
      timeoutMs: 50,
    });
    const response = await transport({
      apiKey: 'secret',
      body: '{"model":"jev-latest"}',
      signal: undefined,
    });
    assert.equal(response.status, 200);
    assert.equal(response.text, OK_BODY);
    assert.equal(captured.url, 'https://api.example.test/v1/systemone');
    const headers = captured.request?.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer secret');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(captured.request?.body, '{"model":"jev-latest"}');
    assert.equal(captured.request?.method, 'POST');
  } finally {
    globalThis.fetch = original;
  }
});
