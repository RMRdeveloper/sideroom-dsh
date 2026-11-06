import { readdir, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { isMissingPathError } from '../errors.js';
import { parseFrontmatter } from './frontmatter.js';
const PROVIDER_NAME = 'sideroom-monorepo';
const SKIPPED_DIRECTORIES = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    'vendor',
    'target',
    'out',
]);
const SKILL_ROOTS = [
    { segment: join('.dsh', 'skills'), baseRank: 120 },
    { segment: join('.agents', 'skills'), baseRank: 220 },
];
async function childDirectories(directory) {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    }
    catch (error) {
        if (isMissingPathError(error)) {
            return [];
        }
        throw new Error(`sideroom-dsh: cannot list ${directory}`, { cause: error });
    }
    const children = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) {
            continue;
        }
        if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) {
            continue;
        }
        children.push(join(directory, entry.name));
    }
    return children;
}
async function directoriesAtDepth(root, maxDepth) {
    const visited = [];
    let frontier = [root];
    for (let depth = 1; depth <= maxDepth; depth += 1) {
        const next = [];
        for (const directory of frontier) {
            next.push(...(await childDirectories(directory)));
        }
        if (next.length === 0) {
            break;
        }
        for (const directory of next) {
            visited.push({ path: directory, depth });
        }
        frontier = next;
    }
    return visited;
}
async function skillFiles(skillsDirectory) {
    let entries;
    try {
        entries = await readdir(skillsDirectory, { withFileTypes: true });
    }
    catch (error) {
        if (isMissingPathError(error)) {
            return [];
        }
        throw new Error(`sideroom-dsh: cannot list ${skillsDirectory}`, {
            cause: error,
        });
    }
    const files = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(join(skillsDirectory, entry.name));
            continue;
        }
        if (!entry.isDirectory() || entry.isSymbolicLink()) {
            continue;
        }
        const bundle = join(skillsDirectory, entry.name, 'SKILL.md');
        try {
            const stats = await lstat(bundle);
            if (stats.isFile()) {
                files.push(bundle);
            }
        }
        catch (error) {
            if (isMissingPathError(error)) {
                continue;
            }
            throw new Error(`sideroom-dsh: cannot inspect ${bundle}`, {
                cause: error,
            });
        }
    }
    return files;
}
async function readSkillFile(file) {
    try {
        return await readFile(file, 'utf8');
    }
    catch (error) {
        if (isMissingPathError(error)) {
            return null;
        }
        throw new Error(`sideroom-dsh: cannot read skill file ${file}`, {
            cause: error,
        });
    }
}
async function candidateFor(file, rank) {
    const text = await readSkillFile(file);
    if (text === null) {
        return null;
    }
    const parsed = parseFrontmatter(text);
    const name = parsed.fields.name;
    const description = parsed.fields.description;
    if (name === undefined || description === undefined) {
        return null;
    }
    return {
        name,
        description,
        whenToUse: parsed.fields.whenToUse,
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'custom',
        provider: PROVIDER_NAME,
        path: file,
        rank,
        locator: { path: file, rank },
    };
}
export function createMonorepoProvider(maxDepth) {
    return () => ({
        name: PROVIDER_NAME,
        async list(options) {
            const root = options.cwd ?? process.cwd();
            const directories = await directoriesAtDepth(root, maxDepth);
            const found = [];
            const seen = new Set();
            for (const directory of directories) {
                for (const skillRoot of SKILL_ROOTS) {
                    const files = await skillFiles(join(directory.path, skillRoot.segment));
                    for (const file of files) {
                        const candidate = await candidateFor(file, skillRoot.baseRank + directory.depth * 10);
                        if (candidate === null || seen.has(candidate.name)) {
                            continue;
                        }
                        seen.add(candidate.name);
                        found.push(candidate);
                    }
                }
            }
            return { candidates: found, complete: true };
        },
        async get(candidate) {
            const locator = candidate.locator;
            const text = await readSkillFile(locator.path);
            if (text === null) {
                return undefined;
            }
            const parsed = parseFrontmatter(text);
            return {
                name: candidate.name,
                description: candidate.description,
                whenToUse: candidate.whenToUse,
                content: parsed.body.trim(),
                path: locator.path,
                source: candidate.source,
                invocation: candidate.invocation,
                provider: PROVIDER_NAME,
            };
        },
    });
}
