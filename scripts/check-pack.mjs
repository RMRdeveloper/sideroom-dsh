import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import semver from 'semver';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'),
);

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function check(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status}): ${(
        result.stderr || result.stdout
      ).trim()}`,
    );
  }
  return result.stdout;
}

function verifyPublishSurface() {
  check(manifest.private !== true, 'package.json: "private": true blocks npm publish');
  check(
    manifest.publishConfig?.access === 'public',
    'package.json: publishConfig.access must be "public" for a scoped package',
  );
  check(
    typeof manifest.name === 'string' && manifest.name.startsWith('@'),
    'package.json: expected a scoped name',
  );
  check(
    manifest.dsh?.bundle?.patch === './cordis.patch.yml',
    'package.json: dsh.bundle.patch must name ./cordis.patch.yml',
  );
  check(
    typeof manifest.engines?.dsh === 'string' && manifest.engines.dsh.length > 0,
    'package.json: engines.dsh is required so the harness can admit the bundle',
  );
  check(
    manifest.files?.length > 0,
    'package.json: "files" must list what ships',
  );
}

function verifyDshRange() {
  const range = manifest.engines?.dsh;
  if (typeof range !== 'string' || range.length === 0) {
    return;
  }

  const accepted = ['0.2.2-rc.1', '0.2.2', '0.2.3-rc.1', '0.2.9'];
  const rejected = ['0.1.9', '0.3.0-rc.1', '0.3.0', '1.0.0'];
  for (const version of accepted) {
    check(
      semver.satisfies(version, range, { includePrerelease: true }),
      `engines.dsh "${range}" must accept dsh ${version}`,
    );
  }
  for (const version of rejected) {
    check(
      !semver.satisfies(version, range, { includePrerelease: true }),
      `engines.dsh "${range}" must reject dsh ${version}`,
    );
  }
}

function verifyPatch() {
  const path = join(PACKAGE_ROOT, 'cordis.patch.yml');
  const document = yaml.load(readFileSync(path, 'utf8'));
  check(Array.isArray(document), 'cordis.patch.yml: expected a top-level patch array');
  const rows = Array.isArray(document)
    ? document.flatMap((entry) => (Array.isArray(entry?.insert) ? entry.insert : []))
    : [];
  check(
    rows.length > 0,
    'cordis.patch.yml: the bundle must insert at least one row',
  );
  for (const row of rows) {
    check(
      row?.name === manifest.name,
      `cordis.patch.yml: row "${row?.id}" must name the package "${manifest.name}" so the loader can import it`,
    );
  }
  return rows;
}

async function verifyLocale() {
  const expected = ['meta.title', 'meta.description'];
  for (const language of ['en', 'es']) {
    const path = join(PACKAGE_ROOT, 'locale', `${language}.json`);
    if (!existsSync(path)) {
      fail(`locale/${language}.json is missing`);
      continue;
    }
    const locale = JSON.parse(readFileSync(path, 'utf8'));
    for (const field of expected) {
      const [group, key] = field.split('.');
      check(
        typeof locale?.[group]?.[key] === 'string' && locale[group][key].trim(),
        `locale/${language}.json: ${field} must be a non-empty string`,
      );
    }
  }
}

function verifyIcon() {
  const path = join(PACKAGE_ROOT, 'icon.svg');
  if (!existsSync(path)) {
    fail('icon.svg is missing; the plugin manager needs ./icon');
    return;
  }
  const size = statSync(path).size;
  check(size <= 256 * 1024, 'icon.svg: must stay under 256 KiB');
  check(
    /^\s*<svg[\s>]/.test(readFileSync(path, 'utf8')),
    'icon.svg: must be a valid SVG document',
  );
}

function verifyPackList(files) {
  const packed = new Set(files.map((file) => file.path));
  const required = [
    'package.json',
    'README.md',
    'LICENSE.txt',
    'lib/index.js',
    'lib/src/config.js',
    'cordis.patch.yml',
    'locale/en.json',
    'locale/es.json',
    'icon.svg',
    'assets/skills/sideroom-guidelines/SKILL.md',
    'assets/skills/sideroom-guidelines/references/languages/typescript.md',
    'assets/skills/sideroom-guidelines/references/languages/python.md',
  ];
  for (const path of required) {
    check(packed.has(path), `packed tarball is missing ${path}`);
  }
  const forbidden = [/^lib\/.*\.test\.js$/, /^src\//, /\.ts$/, /^scripts\//, /^\.github\//, /^node_modules\//, /^package-lock\.json$/];
  for (const file of packed) {
    for (const pattern of forbidden) {
      check(
        !pattern.test(file),
        `packed tarball must not contain ${file} (matched ${pattern})`,
      );
    }
  }
  notes.push(
    `${packed.size} files, ${(files.reduce((total, file) => total + (file.size ?? 0), 0) / 1024).toFixed(0)} KiB packed`,
  );
}

async function verifyExtractedEntry(tarball, workDirectory) {
  const extractDirectory = join(workDirectory, 'extract');
  mkdirSync(extractDirectory, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', extractDirectory]);
  const packageDirectory = join(extractDirectory, 'package');
  const entry = join(packageDirectory, 'lib', 'index.js');
  check(existsSync(entry), 'tarball: lib/index.js is missing');
  if (!existsSync(entry)) {
    return;
  }

  const module = await import(pathToFileURL(entry).href);
  check(typeof module.apply === 'function', 'lib/index.js: must export apply()');
  check(module.name === 'sideroom-dsh', 'lib/index.js: name export drifted');
  check(
    Array.isArray(module.inject) && module.inject.includes('tools'),
    'lib/index.js: inject must list the tools service',
  );

  const { normalizeConfig } = await import(
    pathToFileURL(join(packageDirectory, 'lib', 'src', 'config.js')).href,
  );
  const defaults = normalizeConfig(undefined);
  check(
    defaults.warnings.length === 0,
    `config defaults warn: ${defaults.warnings.join('; ')}`,
  );

  const assetRoot = join(packageDirectory, 'assets', 'skills');
  check(existsSync(assetRoot), 'tarball: assets/skills is missing');
  check(
    existsSync(join(assetRoot, 'sideroom-guidelines', 'SKILL.md')),
    'tarball: the guidelines contract is missing',
  );
  const languages = [
    'typescript',
    'javascript',
    'python',
    'go',
    'rust',
    'java',
    'php-laravel',
  ];
  for (const language of languages) {
    check(
      existsSync(
        join(assetRoot, 'sideroom-guidelines', 'references', 'languages', `${language}.md`),
      ),
      `tarball: the ${language} guide is missing`,
    );
  }
  for (const skill of [
    'sideroom-user-stories',
    'sideroom-codebase-design',
    'sideroom-domain-modeling',
    'sideroom-guidelines',
    'sideroom-architecture',
    'sideroom-grill',
    'sideroom-persona',
    'sideroom-domain-scaffold',
    'sideroom-improve-architecture',
  ]) {
    check(
      existsSync(join(assetRoot, skill, 'SKILL.md')),
      `tarball: the ${skill} skill is missing`,
    );
  }
  notes.push(`entry loaded from ${relative(workDirectory, packageDirectory)}`);
}

function verifyBundleConfig(rows) {
  const row = rows[0];
  if (row === undefined) {
    return;
  }
  notes.push(`row "${row.id}" config keys: ${Object.keys(row.config ?? {}).join(', ')}`);
}

const workDirectory = mkdtempSync(join(tmpdir(), 'sideroom-dsh-pack-'));
try {
  verifyPublishSurface();
  verifyDshRange();
  const rows = verifyPatch();
  verifyBundleConfig(rows);
  await verifyLocale();
  verifyIcon();

  const output = run('npm', [
    'pack',
    '--json',
    '--pack-destination',
    workDirectory,
  ]);
  const [packed] = JSON.parse(output);
  check(packed !== undefined, 'npm pack produced no artifact');
  if (packed === undefined) {
    throw new Error('npm pack produced no artifact');
  }
  verifyPackList(packed.files);
  await verifyExtractedEntry(
    join(workDirectory, packed.filename),
    workDirectory,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('check-pack: the published artifact is not installable:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}
console.log(`check-pack: ${manifest.name}@${manifest.version} is publishable`);
for (const note of notes) {
  console.log(`  ${note}`);
}
