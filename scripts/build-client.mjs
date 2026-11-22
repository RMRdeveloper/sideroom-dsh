import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'src', 'client', 'main.ts');
const OUTPUT = join(ROOT, 'client.js');
const EXTERNAL_MODULES = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
];

const manifest = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

const bundle = await build({
  entryPoints: [ENTRY],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: EXTERNAL_MODULES,
  loader: { '.css': 'text' },
  legalComments: 'none',
  logLevel: 'warning',
});

const code = bundle.outputFiles[0].text.trimEnd();
const artifact = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(manifest.name)},`,
  '  factory(require) {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  code,
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n');

await writeFile(OUTPUT, artifact, 'utf8');
process.stderr.write(
  `client bundle written: ${OUTPUT} (${Buffer.byteLength(artifact)} bytes)\n`,
);
