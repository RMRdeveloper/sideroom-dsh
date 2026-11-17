import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createKeyResolver, type CredentialLookup } from '@/jev/key.js';

function resolverWith({
  environment = {},
  credentials,
}: {
  environment?: Record<string, string | undefined>;
  credentials?: CredentialLookup;
} = {}): () => Promise<{ key: string; origin: string } | undefined> {
  return createKeyResolver({
    environment,
    envName: 'TYPESAFE_API_KEY',
    credentials,
  });
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

test('the environment key wins over a stored credential', async () => {
  const resolve = resolverWith({
    environment: { TYPESAFE_API_KEY: 'env-key' },
    credentials: {
      resolve: () => Promise.resolve({ value: 'stored-key' }),
    },
  });
  assert.deepEqual(await resolve(), { key: 'env-key', origin: 'environment' });
});

test('an absent environment key falls back to the credential store', async () => {
  const calls: string[] = [];
  const resolve = resolverWith({
    credentials: {
      resolve: (ref) => {
        calls.push(ref);
        return Promise.resolve({ value: 'stored-key' });
      },
    },
  });
  assert.deepEqual(await resolve(), {
    key: 'stored-key',
    origin: 'credentials',
  });
  assert.deepEqual(calls, ['TYPESAFE_API_KEY']);
});

test('a blank environment value falls back to the credential store', async () => {
  const resolve = resolverWith({
    environment: { TYPESAFE_API_KEY: '   ' },
    credentials: {
      resolve: () => Promise.resolve({ value: 'stored-key' }),
    },
  });
  assert.deepEqual(await resolve(), {
    key: 'stored-key',
    origin: 'credentials',
  });
});

test('the resolved value is trimmed', async () => {
  const resolve = resolverWith({
    environment: { TYPESAFE_API_KEY: '  env-key  ' },
  });
  assert.deepEqual(await resolve(), { key: 'env-key', origin: 'environment' });
});

test('no source means no key', async () => {
  assert.equal(await resolverWith()(), undefined);
  const empty = resolverWith({
    credentials: { resolve: () => Promise.resolve({ value: '  ' }) },
  });
  assert.equal(await empty(), undefined);
  const absent = resolverWith({
    credentials: { resolve: () => Promise.resolve(undefined) },
  });
  assert.equal(await absent(), undefined);
});

test('a credential lookup failure is reported and ignored', async () => {
  const warnings = captureWarnings();
  try {
    const resolve = resolverWith({
      credentials: {
        resolve: () => Promise.reject(new Error('store offline')),
      },
    });
    assert.equal(await resolve(), undefined);
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /store offline/);
});
