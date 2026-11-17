import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  companionTestPaths,
  createRelatedSource,
  modulePath,
  references,
  type FsEntryLike,
  type FsTargetLike,
  type RelatedFileSystem,
} from '@/jev/context.js';

function virtualFileSystem(files: Record<string, string>): RelatedFileSystem {
  const directories = new Set<string>(['']);
  for (const path of Object.keys(files)) {
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join('/'));
    }
  }
  const targetFor = (path: string): FsTargetLike => ({ targetKey: path });
  return {
    resolve: (path) =>
      Promise.resolve(targetFor(path === '.' ? '' : path.replace(/^\.\//u, ''))),
    stat: (target) => {
      const body = files[target.targetKey];
      if (body !== undefined) {
        return Promise.resolve({ type: 'file', size: body.length });
      }
      return Promise.resolve(
        directories.has(target.targetKey) ? { type: 'directory' } : undefined,
      );
    },
    readText: (target) => {
      const body = files[target.targetKey];
      return body === undefined
        ? Promise.reject(Object.assign(new Error('missing'), {
            code: 'FS_NOT_FOUND',
          }))
        : Promise.resolve(body);
    },
    listDir: (target) => {
      const prefix = target.targetKey === '' ? '' : `${target.targetKey}/`;
      const entries = new Map<string, FsEntryLike>();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) {
          continue;
        }
        const rest = path.slice(prefix.length);
        const name = rest.split('/')[0];
        if (name === undefined || name === '') {
          continue;
        }
        const isDirectory = rest.includes('/');
        entries.set(name, {
          name,
          type: isDirectory ? 'directory' : 'file',
          target: targetFor(`${prefix}${name}`),
          size: isDirectory ? undefined : files[`${prefix}${name}`]?.length,
        });
      }
      return Promise.resolve(
        [...entries.values()].sort((left, right) =>
          left.name < right.name ? -1 : 1,
        ),
      );
    },
  };
}

function collector(
  files: Record<string, string>,
  {
    maxFiles = 4,
    scanForConsumers = false,
  }: { maxFiles?: number; scanForConsumers?: boolean } = {},
): ReturnType<typeof createRelatedSource> {
  return createRelatedSource({
    fs: virtualFileSystem(files),
    settings: { maxFiles, scanForConsumers },
  });
}

test('a relative import becomes related source', async () => {
  const source = collector({
    'src/app.ts': 'import { total } from \'./util\';\nexport const doubled = total;\n',
    'src/util.ts': 'export const total = 1;\n',
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: 'import { total } from \'./util\';\nexport const doubled = total;\n',
  });
  assert.deepEqual(
    collected.files.map((file) => [file.path, file.relation]),
    [['src/util.ts', 'imported']],
  );
  assert.equal(collected.partial, false);
});

test('a directory import resolves to its index file', async () => {
  const source = collector({
    'src/app.ts': 'import { total } from \'./lib\';\n',
    'src/lib/index.ts': 'export const total = 1;\n',
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: 'import { total } from \'./lib\';\n',
  });
  assert.deepEqual(collected.files.map((file) => file.path), ['src/lib/index.ts']);
});

test('a sibling test file becomes related source', async () => {
  const source = collector({
    'src/app.ts': 'export const total = 1;\n',
    'src/app.test.ts': 'assert.equal(total, 1);\n',
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: 'export const total = 1;\n',
  });
  assert.deepEqual(
    collected.files.map((file) => [file.path, file.relation]),
    [['src/app.test.ts', 'test']],
  );
});

test('consumers are found only when the scan is enabled', async () => {
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/consumer.ts': 'import { total } from \'./app\';\n',
  };
  const off = await collector(files).collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.deepEqual(off.files, []);
  const on = await collector(files, { scanForConsumers: true }).collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.deepEqual(
    on.files.map((file) => [file.path, file.relation]),
    [['src/consumer.ts', 'consumer']],
  );
});

test('the related list is capped by the configured maximum', async () => {
  const source = collector(
    {
      'src/app.ts': 'import { total } from \'./util\';\n',
      'src/util.ts': 'export const total = 1;\n',
      'src/app.test.ts': 'assert.equal(total, 1);\n',
    },
    { maxFiles: 1 },
  );
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: 'import { total } from \'./util\';\n',
  });
  assert.equal(collected.files.length, 1);
});

test('a missing file system reports partial context', async () => {
  const source = createRelatedSource({
    fs: undefined,
    settings: { maxFiles: 4, scanForConsumers: false },
  });
  assert.deepEqual(
    await source.collect({ cwd: '/repo', path: 'src/app.ts', body: 'x' }),
    { files: [], partial: true },
  );
});

test('references read relative imports for source languages', () => {
  assert.deepEqual(
    [...references('src/app.ts', 'import x from \'./util\';\nimport \'./side-effect\';\nconst y = require(\'./legacy\');')],
    ['src/util', 'src/side-effect', 'src/legacy'],
  );
  assert.deepEqual([...references('README.md', 'import x from \'./util\';')], []);
  assert.deepEqual(
    [...references('pkg/mod.py', 'from .util import x\n')],
    ['pkg/util'],
  );
});

test('the module path drops the extension and the index file', () => {
  assert.equal(modulePath('src/app.ts'), 'src/app');
  assert.equal(modulePath('src/lib/index.ts'), 'src/lib');
  assert.equal(modulePath('src/README'), 'src/README');
});

test('companion test paths cover the sibling conventions', () => {
  assert.deepEqual(companionTestPaths('src/app.ts'), [
    'src/app.test.ts',
    'src/app.spec.ts',
    'src/app_test.ts',
    'src/test_app.ts',
  ]);
  assert.deepEqual(companionTestPaths('Makefile'), []);
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

test('a spec sibling is used when the test sibling is absent', async () => {
  const source = collector({
    'src/app.ts': 'export const total = 1;\n',
    'src/app.spec.ts': 'assert.equal(total, 1);\n',
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: 'export const total = 1;\n',
  });
  assert.deepEqual(
    collected.files.map((file) => [file.path, file.relation]),
    [['src/app.spec.ts', 'test']],
  );
});

test('more than eight imports report partial context', async () => {
  const imports = Array.from(
    { length: 9 },
    (_, index) => `import { value${String(index)} } from './mod${String(index)}';`,
  ).join('\n');
  const source = collector({ 'src/app.ts': imports });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: imports,
  });
  assert.equal(collected.partial, true);
});

test('the consumer scan skips hidden, sensitive and generated paths', async () => {
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/.hidden.ts': 'import { total } from \'./app\';\n',
    'src/secret.ts': 'import { total } from \'./app\';\n',
    'src/app.test.ts': 'import { total } from \'./app\';\n',
    'node_modules/dep/index.ts': 'import { total } from \'../../src/app\';\n',
    'src/README.md': 'import { total } from \'./app\';\n',
  };
  const source = collector(files, { scanForConsumers: true });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.deepEqual(
    collected.files.map((file) => [file.path, file.relation]),
    [['src/app.test.ts', 'test']],
  );
  assert.equal(collected.partial, false);
});

test('an oversized consumer file reports partial context', async () => {
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/big.ts': `import { total } from './app';\n${'x'.repeat(1_000)}`,
  };
  const source = createRelatedSource({
    fs: virtualFileSystem(files),
    settings: { maxFiles: 4, scanForConsumers: true },
    maxCandidateBytes: 100,
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.deepEqual(collected.files, []);
  assert.equal(collected.partial, true);
});

test('a listing failure reports partial context and keeps going', async () => {
  const warnings = captureWarnings();
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/consumer.ts': 'import { total } from \'./app\';\n',
  };
  const source = createRelatedSource({
    fs: {
      ...virtualFileSystem(files),
      listDir: () => Promise.reject(new Error('listing failed')),
    },
    settings: { maxFiles: 4, scanForConsumers: true },
  });
  try {
    const collected = await source.collect({
      cwd: '/repo',
      path: 'src/app.ts',
      body: files['src/app.ts'],
    });
    assert.deepEqual(collected.files, []);
    assert.equal(collected.partial, true);
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /listing failed/);
});

test('a consumer read failure reports partial context', async () => {
  const warnings = captureWarnings();
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/consumer.ts': 'import { total } from \'./app\';\n',
  };
  const base = virtualFileSystem(files);
  const source = createRelatedSource({
    fs: {
      ...base,
      readText: (target) =>
        target.targetKey === 'src/consumer.ts'
          ? Promise.reject(new Error('read failed'))
          : base.readText(target),
    },
    settings: { maxFiles: 4, scanForConsumers: true },
  });
  try {
    const collected = await source.collect({
      cwd: '/repo',
      path: 'src/app.ts',
      body: files['src/app.ts'],
    });
    assert.deepEqual(collected.files, []);
    assert.equal(collected.partial, true);
  } finally {
    warnings.restore();
  }
  assert.match(String(warnings.messages[0]), /read failed/);
});

test('the scan stops at the configured depth', async () => {
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/deep/consumer.ts': 'import { total } from \'../app\';\n',
  };
  const source = createRelatedSource({
    fs: virtualFileSystem(files),
    settings: { maxFiles: 4, scanForConsumers: true },
    maxScanDepth: 0,
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.deepEqual(collected.files, []);
  assert.equal(collected.partial, true);
});

test('the scan stops at the file budget', async () => {
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/consumer.ts': 'import { total } from \'./app\';\n',
  };
  const source = createRelatedSource({
    fs: virtualFileSystem(files),
    settings: { maxFiles: 4, scanForConsumers: true },
    maxScanFiles: 0,
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.deepEqual(collected.files, []);
  assert.equal(collected.partial, true);
});

test('a non-absent file system error is rethrown', async () => {
  const files = {
    'src/app.ts': 'import { total } from \'./util\';\n',
  };
  const source = createRelatedSource({
    fs: {
      ...virtualFileSystem(files),
      stat: () =>
        Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })),
    },
    settings: { maxFiles: 4, scanForConsumers: false },
  });
  await assert.rejects(
    source.collect({
      cwd: '/repo',
      path: 'src/app.ts',
      body: files['src/app.ts'],
    }),
    /denied/,
  );
});

test('a relative python import with a parent step resolves', () => {
  assert.deepEqual(
    [...references('pkg/sub/mod.py', 'from ..pkg import x\n')],
    ['pkg/pkg'],
  );
});

test('a matching consumer stops at the remaining slot', async () => {
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/first.ts': 'import { total } from \'./app\';\n',
    'src/second.ts': 'import { total } from \'./app\';\n',
  };
  const source = createRelatedSource({
    fs: virtualFileSystem(files),
    settings: { maxFiles: 1, scanForConsumers: true },
  });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.equal(collected.files.length, 1);
});

test('a consumer without a matching reference is skipped', async () => {
  const files = {
    'src/app.ts': 'export const total = 1;\n',
    'src/other.ts': 'import { other } from \'./unrelated\';\n',
  };
  const source = collector(files, { scanForConsumers: true });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: files['src/app.ts'],
  });
  assert.deepEqual(collected.files, []);
});

test('an import that resolves to no file adds nothing', async () => {
  const source = collector({ 'src/app.ts': 'import { x } from \'./missing\';\n' });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body: 'import { x } from \'./missing\';\n',
  });
  assert.deepEqual(collected.files, []);
  assert.equal(collected.partial, false);
});

test('nine resolvable imports report partial context', async () => {
  const files: Record<string, string> = { 'src/app.ts': '' };
  const imports: string[] = [];
  for (let index = 0; index < 9; index += 1) {
    files[`src/mod${String(index)}.ts`] = 'export const value = 1;\n';
    imports.push(`import { value${String(index)} } from './mod${String(index)}';`);
  }
  const body = imports.join('\n');
  files['src/app.ts'] = body;
  const source = collector(files, { maxFiles: 8 });
  const collected = await source.collect({
    cwd: '/repo',
    path: 'src/app.ts',
    body,
  });
  assert.equal(collected.files.length, 8);
  assert.equal(collected.partial, true);
});
