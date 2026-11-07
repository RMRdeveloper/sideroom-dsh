import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { createSkillCatalog } from '@/skills/catalog.js';

async function fixtureRoot(
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sideroom-catalog-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return root;
}

const USER_INVOKED_SKILL = 'sideroom-improve-architecture';

test('the packaged catalog exposes every sideroom skill', () => {
  const catalog = createSkillCatalog(process.cwd());
  const names = catalog.map((skill) => skill.name).sort();
  assert.deepEqual(names, [
    'sideroom-architecture',
    'sideroom-codebase-design',
    'sideroom-domain-modeling',
    'sideroom-domain-scaffold',
    'sideroom-grill',
    'sideroom-guidelines',
    USER_INVOKED_SKILL,
    'sideroom-persona',
    'sideroom-user-stories',
  ]);
  for (const skill of catalog) {
    assert.notEqual(skill.description, '');
    assert.notEqual(skill.content, '');
    assert.equal(skill.source, 'bundled');
    assert.equal(skill.resourceBase?.kind, 'directory');
    assert.equal(
      skill.invocation?.modelInvocable,
      skill.name !== USER_INVOKED_SKILL,
    );
    assert.equal(skill.invocation?.userInvocable, true);
  }
});

test('a missing skills directory yields an empty catalog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sideroom-empty-catalog-'));
  try {
    assert.deepEqual(createSkillCatalog(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a skill directory without SKILL.md is skipped', async () => {
  const root = await fixtureRoot({
    'assets/skills/empty/README.md': 'not a skill',
  });
  try {
    assert.deepEqual(createSkillCatalog(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a skill without a description is skipped', async () => {
  const root = await fixtureRoot({
    'assets/skills/broken/SKILL.md': '---\nname: broken\n---\nbody',
  });
  try {
    assert.deepEqual(createSkillCatalog(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a skill without a frontmatter name uses its directory name', async () => {
  const root = await fixtureRoot({
    'assets/skills/folder-name/SKILL.md':
      '---\ndescription: A skill\n---\n  body  \n',
  });
  try {
    const [skill] = createSkillCatalog(root);
    assert.equal(skill.name, 'folder-name');
    assert.equal(skill.content, 'body');
    assert.equal(skill.path, join(root, 'assets/skills/folder-name/SKILL.md'));
    assert.deepEqual(skill.resourceBase, {
      kind: 'directory',
      path: join(root, 'assets/skills/folder-name'),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('invocation flags follow the frontmatter', async () => {
  const root = await fixtureRoot({
    'assets/skills/hidden/SKILL.md':
      '---\nname: hidden\ndescription: Hidden\ndisable-model-invocation: true\nuser-invocable: false\n---\nbody',
  });
  try {
    const [skill] = createSkillCatalog(root);
    assert.equal(skill.invocation?.modelInvocable, false);
    assert.equal(skill.invocation?.userInvocable, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('files next to skill directories are ignored', async () => {
  const root = await fixtureRoot({
    'assets/skills/notes.txt': 'ignore me',
    'assets/skills/real/SKILL.md':
      '---\nname: real\ndescription: Real\n---\nbody',
  });
  try {
    const catalog = createSkillCatalog(root);
    assert.deepEqual(catalog.map((skill) => skill.name), ['real']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a skill file that cannot be read fails with the path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sideroom-broken-skill-'));
  try {
    await mkdir(join(root, 'assets/skills/broken/SKILL.md'), {
      recursive: true,
    });
    assert.throws(
      () => createSkillCatalog(root),
      /cannot read skill file/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
