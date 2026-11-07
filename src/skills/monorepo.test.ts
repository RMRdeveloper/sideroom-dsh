import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import type {
  SkillCandidate,
  SkillProvider,
  SkillProviderObservation,
} from '@deepseek-ai/dsh-skill';
import { createMonorepoProvider } from '@/skills/monorepo.js';

async function fixture(
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sideroom-monorepo-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return root;
}

function provider(maxDepth = 3): SkillProvider {
  return createMonorepoProvider(maxDepth)({
    signal: new AbortController().signal,
    invalidate: () => undefined,
  });
}

function isObservation(
  value: readonly SkillCandidate[] | SkillProviderObservation,
): value is SkillProviderObservation {
  return !Array.isArray(value);
}

async function listed(
  providerValue: SkillProvider,
  cwd: string,
): Promise<SkillProviderObservation> {
  const result = await providerValue.list({ cwd });
  return isObservation(result)
    ? result
    : { candidates: result, complete: true };
}

const SKILL = (name: string, extra = ''): string =>
  `---\nname: ${name}\ndescription: Description of ${name}\n${extra}---\nBody of ${name}\n`;

test('discovers .dsh and .agents skills below the working directory', async () => {
  const root = await fixture({
    'packages/a/.dsh/skills/dsh-skill.md': SKILL('dsh-skill'),
    'packages/a/.agents/skills/agent-skill.md': SKILL('agent-skill'),
    'packages/a/.agents/skills/bundle/SKILL.md': SKILL('bundle'),
  });
  try {
    const observation = await listed(provider(), root);
    assert.equal(observation.complete, true);
    const names = observation.candidates.map((candidate) => candidate.name);
    assert.deepEqual(names.sort(), [
      'agent-skill',
      'bundle',
      'dsh-skill',
    ]);
    for (const candidate of observation.candidates) {
      assert.equal(candidate.source, 'custom');
      assert.equal(candidate.provider, 'sideroom-monorepo');
      assert.equal(candidate.invocation.modelInvocable, true);
      assert.equal(candidate.invocation.userInvocable, true);
      assert.ok(candidate.rank > 0);
      assert.ok(candidate.path !== undefined);
      assert.ok(candidate.path.endsWith('.md'));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the working directory itself is not scanned', async () => {
  const root = await fixture({
    '.dsh/skills/root.md': SKILL('root'),
  });
  try {
    assert.deepEqual((await listed(provider(), root)).candidates, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a nested skill is found up to the configured depth', async () => {
  const root = await fixture({
    'one/two/three/.dsh/skills/deep.md': SKILL('deep'),
  });
  try {
    assert.deepEqual(
      (await listed(provider(2), root)).candidates.map((c) => c.name),
      [],
    );
    assert.deepEqual(
      (await listed(provider(3), root)).candidates.map((c) => c.name),
      ['deep'],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hidden, build and symlinked directories are skipped', async () => {
  const root = await fixture({
    '.hidden/.dsh/skills/hidden.md': SKILL('hidden'),
    'node_modules/.dsh/skills/modules.md': SKILL('modules'),
    'dist/.dsh/skills/dist.md': SKILL('dist'),
    'real/.dsh/skills/real.md': SKILL('real'),
  });
  try {
    await symlink(join(root, 'real'), join(root, 'linked'));
    const names = (await listed(provider(), root)).candidates.map((c) => c.name);
    assert.deepEqual(names, ['real']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a skill without a name or description is skipped', async () => {
  const root = await fixture({
    'pkg/.dsh/skills/no-description.md': '---\nname: no-description\n---\nbody',
    'pkg/.dsh/skills/no-name.md': '---\ndescription: missing name\n---\nbody',
    'pkg/.dsh/skills/valid.md': SKILL('valid'),
  });
  try {
    assert.deepEqual(
      (await listed(provider(), root)).candidates.map((c) => c.name),
      ['valid'],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('duplicate names keep the first candidate and dsh wins over agents', async () => {
  const root = await fixture({
    'pkg/.dsh/skills/duplicate.md': SKILL('duplicate', 'whenToUse: from-dsh\n'),
    'pkg/.agents/skills/duplicate.md': SKILL('duplicate', 'whenToUse: from-agents\n'),
  });
  try {
    const candidates = (await listed(provider(), root)).candidates;
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].whenToUse, 'from-dsh');
    assert.ok(candidates[0].path !== undefined);
    assert.match(candidates[0].path, /\.dsh/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('whenToUse and rank are reported', async () => {
  const root = await fixture({
    'pkg/.dsh/skills/one.md': SKILL('one', 'whenToUse: When you need one\n'),
    'pkg/.agents/skills/two.md': SKILL('two', 'whenToUse: When you need two\n'),
  });
  try {
    const candidates = (await listed(provider(), root)).candidates;
    const dsh = candidates.find((candidate) => candidate.name === 'one');
    const agents = candidates.find((candidate) => candidate.name === 'two');
    assert.equal(dsh?.whenToUse, 'When you need one');
    assert.equal(agents?.whenToUse, 'When you need two');
    assert.equal(dsh?.rank, 130);
    assert.equal(agents?.rank, 230);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('get returns the full skill definition', async () => {
  const root = await fixture({
    'pkg/.dsh/skills/one.md': SKILL('one'),
  });
  try {
    const [candidate] = (await listed(provider(), root)).candidates;
    const definition = await provider().get(candidate, { cwd: root });
    assert.ok(definition !== undefined);
    assert.equal(definition.name, 'one');
    assert.equal(definition.description, 'Description of one');
    assert.equal(definition.content, 'Body of one');
    assert.equal(definition.path, candidate.path);
    assert.equal(definition.source, 'custom');
    assert.equal(definition.provider, 'sideroom-monorepo');
    assert.equal(definition.invocation.modelInvocable, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('get returns undefined when the file disappeared', async () => {
  const root = await fixture({
    'pkg/.dsh/skills/one.md': SKILL('one'),
  });
  try {
    const [candidate] = (await listed(provider(), root)).candidates;
    assert.ok(candidate.path !== undefined);
    await rm(candidate.path);
    assert.equal(await provider().get(candidate, { cwd: root }), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a missing working directory yields no candidates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sideroom-missing-'));
  try {
    assert.deepEqual(
      (await listed(provider(), join(root, 'absent'))).candidates,
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a skill file with no frontmatter keeps the raw body', async () => {
  const root = await fixture({
    'pkg/.dsh/skills/raw.md': '---\nname: raw\ndescription: Raw\n---\nraw body',
  });
  try {
    const [candidate] = (await listed(provider(), root)).candidates;
    const definition = await provider().get(candidate, { cwd: root });
    assert.equal(definition?.content, 'raw body');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
