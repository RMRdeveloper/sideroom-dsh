import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  commandMatches,
  detectCheckCommand,
} from '@/checks/detect.js';

async function fixture(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'sideroom-detect-'));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(directory, name), content);
  }
  return directory;
}

async function withFixture(
  files: Record<string, string>,
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await fixture(files);
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const PACKAGE = (scripts: string): string =>
  JSON.stringify({ scripts: JSON.parse(scripts) as unknown });

test('package managers choose their command prefix', async () => {
  const cases: Array<[string, string]> = [
    ['pnpm-lock.yaml', 'pnpm check'],
    ['yarn.lock', 'yarn check'],
    ['bun.lockb', 'bun run check'],
    ['bun.lock', 'bun run check'],
    ['package-lock.json', 'npm run check'],
  ];
  for (const [lockfile, expected] of cases) {
    await withFixture(
      {
        'package.json': PACKAGE('{"check":"tsc"}'),
        [lockfile]: '',
      },
      async (directory) => {
        assert.deepEqual(await detectCheckCommand(directory), {
          command: expected,
          source: 'package.json',
        });
      },
    );
  }
});

test('without a lockfile npm run is the default', async () => {
  await withFixture(
    { 'package.json': PACKAGE('{"check":"tsc"}') },
    async (directory) => {
      assert.deepEqual(await detectCheckCommand(directory), {
        command: 'npm run check',
        source: 'package.json',
      });
    },
  );
});

test('scripts follow the check, test, lint, typecheck, types order', async () => {
  const cases: Array<[string, string]> = [
    ['{"check":"a","test":"b"}', 'check'],
    ['{"test":"b","lint":"c"}', 'test'],
    ['{"lint":"c","typecheck":"d"}', 'lint'],
    ['{"typecheck":"d","types":"e"}', 'typecheck'],
    ['{"types":"e"}', 'types'],
  ];
  for (const [scripts, expected] of cases) {
    await withFixture(
      { 'package.json': PACKAGE(scripts) },
      async (directory) => {
        assert.equal(
          (await detectCheckCommand(directory))?.command,
          `npm run ${expected}`,
        );
      },
    );
  }
});

test('non-string script values are ignored', async () => {
  await withFixture(
    { 'package.json': PACKAGE('{"check":1,"test":"b"}') },
    async (directory) => {
      assert.equal(
        (await detectCheckCommand(directory))?.command,
        'npm run test',
      );
    },
  );
});

test('a package without scripts falls through to the ecosystem checks', async () => {
  await withFixture(
    { 'package.json': PACKAGE('{}'), 'go.mod': 'module example' },
    async (directory) => {
      assert.deepEqual(await detectCheckCommand(directory), {
        command: 'go test ./...',
        source: 'go.mod',
      });
    },
  );
});

test('scripts that are not an object are ignored', async () => {
  for (const manifest of [
    '{"scripts":null}',
    '{"scripts":"test"}',
    '{"scripts":[]}',
    '[]',
    'null',
  ]) {
    await withFixture(
      { 'package.json': manifest },
      async (directory) => {
        assert.equal(await detectCheckCommand(directory), null, manifest);
      },
    );
  }
});

test('a BOM in package.json is tolerated', async () => {
  await withFixture(
    { 'package.json': `\uFEFF${PACKAGE('{"check":"tsc"}')}` },
    async (directory) => {
      assert.equal(
        (await detectCheckCommand(directory))?.command,
        'npm run check',
      );
    },
  );
});

test('invalid package.json fails fast', async () => {
  await withFixture(
    { 'package.json': '{not json' },
    async (directory) => {
      await assert.rejects(
        () => detectCheckCommand(directory),
        /invalid package.json/,
      );
    },
  );
});

test('go.mod selects the Go check', async () => {
  await withFixture({ 'go.mod': 'module example' }, async (directory) => {
    assert.deepEqual(await detectCheckCommand(directory), {
      command: 'go test ./...',
      source: 'go.mod',
    });
  });
});

test('Cargo.toml selects the Rust check', async () => {
  await withFixture({ 'Cargo.toml': '[package]' }, async (directory) => {
    assert.deepEqual(await detectCheckCommand(directory), {
      command: 'cargo test',
      source: 'Cargo.toml',
    });
  });
});

test('each Python marker selects pytest', async () => {
  for (const marker of ['pyproject.toml', 'setup.py', 'pytest.ini']) {
    await withFixture({ [marker]: '' }, async (directory) => {
      assert.deepEqual(await detectCheckCommand(directory), {
        command: 'pytest -q',
        source: 'python',
      });
    });
  }
});

test('a Makefile check target selects make check', async () => {
  await withFixture(
    { Makefile: 'all:\n\t@echo ok\ncheck:\n\t@echo check\n' },
    async (directory) => {
      assert.deepEqual(await detectCheckCommand(directory), {
        command: 'make check',
        source: 'Makefile',
      });
    },
  );
});

test('a Makefile without a check target selects nothing', async () => {
  await withFixture(
    { Makefile: '  check:\n\t@echo indented\n' },
    async (directory) => {
      assert.equal(await detectCheckCommand(directory), null);
    },
  );
});

test('a directory without a known check reports none', async () => {
  await withFixture({}, async (directory) => {
    assert.equal(await detectCheckCommand(directory), null);
  });
});

test('command matching collapses only horizontal whitespace', () => {
  assert.equal(commandMatches('  pnpm   check  ', 'pnpm check'), true);
  assert.equal(commandMatches('pnpm\tcheck', 'pnpm check'), true);
  assert.equal(commandMatches('pnpm check -- --help', 'pnpm check'), false);
  assert.equal(commandMatches('cd site && pnpm check', 'pnpm check'), false);
  assert.equal(commandMatches('pnpm check\npnpm test', 'pnpm check'), false);
  assert.equal(commandMatches('', ''), true);
  assert.equal(commandMatches('', 'pnpm check'), false);
});
