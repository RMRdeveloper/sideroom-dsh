import { posix } from 'node:path';
import { isTestPath, type JevRelatedFile } from '@/jev/model.js';
import {
  CODE_COMMENT_PATTERN,
  IMPORT_PATTERNS,
  PROBE_EXTENSIONS,
  PROBE_INDEXES,
  PYTHON_IMPORT_PATTERN,
  SENSITIVE_NAME,
  SKIP_DIRECTORIES,
} from '@/jev/patterns.js';
import { GENERAL_LANGUAGE, languageOfPath } from '@/languages.js';
import { reportError } from '@/report.js';

const DEFAULT_MAX_CANDIDATE_BYTES = 32_000;
const DEFAULT_MAX_SCAN_FILES = 1_024;
const DEFAULT_MAX_SCAN_DEPTH = 10;
const MAX_RELATED_PROBES = 8;
const TYPESCRIPT_LANGUAGES: ReadonlySet<string> = new Set([
  'typescript',
  'javascript',
]);
const PYTHON_LANGUAGE = 'python';

export interface FsTargetLike {
  targetKey: string;
}

export interface FsInfoLike {
  type: string;
  size?: number;
}

export interface FsEntryLike {
  name: string;
  type: string;
  target: FsTargetLike;
  size?: number;
}

export interface RelatedFileSystem {
  resolve(
    path: string,
    options?: { cwd?: string },
  ): Promise<FsTargetLike>;
  stat(
    target: FsTargetLike,
    signal?: AbortSignal,
  ): Promise<FsInfoLike | undefined>;
  readText(target: FsTargetLike, signal?: AbortSignal): Promise<string>;
  listDir(target: FsTargetLike, signal?: AbortSignal): Promise<FsEntryLike[]>;
}

export interface RelatedSourceSettings {
  maxFiles: number;
  scanForConsumers: boolean;
}

export interface RelatedSourceOptions {
  fs: RelatedFileSystem | undefined;
  settings: RelatedSourceSettings;
  maxCandidateBytes?: number;
  maxScanFiles?: number;
  maxScanDepth?: number;
}

export interface RelatedSourceInput {
  cwd: string;
  path: string;
  body: string;
}

export interface RelatedSourceResult {
  files: JevRelatedFile[];
  partial: boolean;
}

export interface RelatedSource {
  collect(input: RelatedSourceInput): Promise<RelatedSourceResult>;
}

export function createRelatedSource({
  fs,
  settings,
  maxCandidateBytes = DEFAULT_MAX_CANDIDATE_BYTES,
  maxScanFiles = DEFAULT_MAX_SCAN_FILES,
  maxScanDepth = DEFAULT_MAX_SCAN_DEPTH,
}: RelatedSourceOptions): RelatedSource {
  async function collect({
    cwd,
    path,
    body,
  }: RelatedSourceInput): Promise<RelatedSourceResult> {
    if (fs === undefined) {
      return { files: [], partial: true };
    }
    const imported = await collectImports({ cwd, path, body, fs });
    const files = [...imported.files];
    let partial = imported.partial;
    if (files.length < settings.maxFiles) {
      const testFile = await collectCompanionTest({ cwd, path, fs });
      if (testFile !== undefined) {
        files.push(testFile);
      }
    }
    if (settings.scanForConsumers && files.length < settings.maxFiles) {
      const consumers = await collectConsumers({
        cwd,
        path,
        fs,
        maxBytes: maxCandidateBytes,
        maxFiles: maxScanFiles,
        maxDepth: maxScanDepth,
        limit: settings.maxFiles - files.length,
      });
      files.push(...consumers.files);
      partial = partial || consumers.partial;
    }
    return { files: files.slice(0, settings.maxFiles), partial };
  }

  return { collect };
}

async function collectImports({
  cwd,
  path,
  body,
  fs,
}: {
  cwd: string;
  path: string;
  body: string;
  fs: RelatedFileSystem;
}): Promise<{ files: JevRelatedFile[]; partial: boolean }> {
  const candidates = [...references(path, body)];
  const files: JevRelatedFile[] = [];
  const partial = candidates.length > MAX_RELATED_PROBES;
  for (const candidate of candidates) {
    if (files.length >= MAX_RELATED_PROBES) {
      return { files, partial: true };
    }
    const resolved = await resolveModule({ cwd, requested: candidate, fs });
    if (resolved === undefined || resolved.path === path) {
      continue;
    }
    files.push({ ...resolved, relation: 'imported' });
  }
  return { files, partial };
}

async function collectCompanionTest({
  cwd,
  path,
  fs,
}: {
  cwd: string;
  path: string;
  fs: RelatedFileSystem;
}): Promise<JevRelatedFile | undefined> {
  for (const candidate of companionTestPaths(path)) {
    const resolved = await readCandidate({ cwd, path: candidate, fs });
    if (resolved === undefined) {
      continue;
    }
    return { ...resolved, relation: 'test' };
  }
  return undefined;
}

async function collectConsumers({
  cwd,
  path,
  fs,
  maxBytes,
  maxFiles,
  maxDepth,
  limit,
}: {
  cwd: string;
  path: string;
  fs: RelatedFileSystem;
  maxBytes: number;
  maxFiles: number;
  maxDepth: number;
  limit: number;
}): Promise<{ files: JevRelatedFile[]; partial: boolean }> {
  const requested = modulePath(path);
  const files: JevRelatedFile[] = [];
  let visited = 0;
  let partial = false;
  const root = await fs.resolve('.', { cwd });
  const queue: Array<{ target: FsTargetLike; relative: string; depth: number }>
    = [{ target: root, relative: '', depth: 0 }];
  while (queue.length > 0) {
    const directory = queue.shift();
    if (directory === undefined) {
      break;
    }
    if (directory.depth > maxDepth) {
      partial = true;
      continue;
    }
    const entries = await listOrReport(fs, directory.target);
    if (entries === undefined) {
      partial = true;
      continue;
    }
    for (const entry of entries) {
      if (visited >= maxFiles) {
        return { files, partial: true };
      }
      if (entry.name.startsWith('.') || SENSITIVE_NAME.test(entry.name)) {
        continue;
      }
      const relative
        = directory.relative === ''
          ? entry.name
          : `${directory.relative}/${entry.name}`;
      if (entry.type === 'directory') {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          queue.push({
            target: entry.target,
            relative,
            depth: directory.depth + 1,
          });
        }
        continue;
      }
      if (entry.type !== 'file' || relative === path) {
        continue;
      }
      if (
        languageOfPath(relative) === GENERAL_LANGUAGE
        || isTestPath(relative)
      ) {
        continue;
      }
      visited += 1;
      if ((entry.size ?? 0) > maxBytes) {
        partial = true;
        continue;
      }
      const consumerBody = await textOrReport(fs, entry.target);
      if (consumerBody === undefined) {
        partial = true;
        continue;
      }
      if (!references(relative, consumerBody).has(requested)) {
        continue;
      }
      files.push({ path: relative, body: consumerBody, relation: 'consumer' });
      if (files.length >= limit) {
        return { files, partial };
      }
    }
  }
  return { files, partial };
}

async function listOrReport(
  fs: RelatedFileSystem,
  target: FsTargetLike,
): Promise<FsEntryLike[] | undefined> {
  try {
    return await fs.listDir(target);
  } catch (error) {
    reportError(error);
    return undefined;
  }
}

async function textOrReport(
  fs: RelatedFileSystem,
  target: FsTargetLike,
): Promise<string | undefined> {
  try {
    return await fs.readText(target);
  } catch (error) {
    reportError(error);
    return undefined;
  }
}

async function resolveModule({
  cwd,
  requested,
  fs,
}: {
  cwd: string;
  requested: string;
  fs: RelatedFileSystem;
}): Promise<{ path: string; body: string } | undefined> {
  const probes = [
    ...PROBE_EXTENSIONS.map((extension) => `${requested}${extension}`),
    ...PROBE_INDEXES.map((index) => `${requested}/${index}`),
  ];
  for (const probe of probes) {
    const candidate = await readCandidate({ cwd, path: probe, fs });
    if (candidate !== undefined) {
      return candidate;
    }
  }
  return undefined;
}

async function readCandidate({
  cwd,
  path,
  fs,
}: {
  cwd: string;
  path: string;
  fs: RelatedFileSystem;
}): Promise<{ path: string; body: string } | undefined> {
  try {
    return await readFile({ cwd, path, fs });
  } catch (error) {
    if (!isAbsentError(error)) {
      throw error;
    }
    return undefined;
  }
}

async function readFile({
  cwd,
  path,
  fs,
}: {
  cwd: string;
  path: string;
  fs: RelatedFileSystem;
}): Promise<{ path: string; body: string } | undefined> {
  const target = await fs.resolve(path, { cwd });
  const metadata = await fs.stat(target);
  if (metadata?.type !== 'file') {
    return undefined;
  }
  return { path, body: await fs.readText(target) };
}

function isAbsentError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return (
    code === 'ENOENT'
    || code === 'ENOTDIR'
    || code === 'FS_NOT_FOUND'
    || code === 'FS_NOT_REGULAR_FILE'
  );
}

export function references(path: string, body: string): Set<string> {
  const names = new Set<string>();
  const language = languageOfPath(path);
  const code = body.replace(CODE_COMMENT_PATTERN, '');
  if (TYPESCRIPT_LANGUAGES.has(language)) {
    for (const pattern of IMPORT_PATTERNS) {
      for (const match of code.matchAll(pattern)) {
        const specifier = match[1];
        if (specifier !== undefined) {
          names.add(
            modulePath(
              posix.normalize(posix.join(posix.dirname(path), specifier)),
            ),
          );
        }
      }
    }
  }
  if (language === PYTHON_LANGUAGE) {
    for (const match of code.matchAll(PYTHON_IMPORT_PATTERN)) {
      const dots = match[1]?.length ?? 0;
      const specifier = match[2]?.replaceAll('.', '/') ?? '';
      const parent = posix.resolve(
        '/',
        posix.dirname(path),
        ...Array.from({ length: Math.max(dots - 1, 0) }, () => '..'),
      );
      names.add(modulePath(posix.join(parent.slice(1), specifier)));
    }
  }
  return names;
}

export function modulePath(path: string): string {
  const extension = posix.extname(path);
  const withoutExtension
    = extension === '' ? path : path.slice(0, -extension.length);
  return withoutExtension.endsWith('/index')
    ? withoutExtension.slice(0, -'/index'.length)
    : withoutExtension;
}

export function companionTestPaths(path: string): string[] {
  const extension = posix.extname(path);
  if (extension === '') {
    return [];
  }
  const base = path.slice(0, -extension.length);
  return [
    `${base}.test${extension}`,
    `${base}.spec${extension}`,
    `${base}_test${extension}`,
    posix.join(posix.dirname(path), `test_${posix.basename(path)}`),
  ];
}
