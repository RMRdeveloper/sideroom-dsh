import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { isMissingPathError } from '../errors.js';
const SCRIPT_PRIORITY = ['check', 'test', 'lint', 'typecheck', 'types'];
const MANAGERS = [
    { lockfile: 'pnpm-lock.yaml', prefix: 'pnpm' },
    { lockfile: 'yarn.lock', prefix: 'yarn' },
    { lockfile: 'bun.lockb', prefix: 'bun run' },
    { lockfile: 'bun.lock', prefix: 'bun run' },
    { lockfile: 'package-lock.json', prefix: 'npm run' },
];
async function fileExists(path) {
    try {
        await access(path);
        return true;
    }
    catch (error) {
        if (isMissingPathError(error)) {
            return false;
        }
        throw new Error(`sideroom-dsh: cannot inspect ${path}`, { cause: error });
    }
}
async function readText(path) {
    try {
        const text = await readFile(path, 'utf8');
        return text.replace(/^\uFEFF/, '');
    }
    catch (error) {
        if (isMissingPathError(error)) {
            return null;
        }
        throw new Error(`sideroom-dsh: cannot read ${path}`, { cause: error });
    }
}
async function managerPrefix(cwd) {
    for (const manager of MANAGERS) {
        if (await fileExists(join(cwd, manager.lockfile))) {
            return manager.prefix;
        }
    }
    return 'npm run';
}
async function packageScriptCommand(cwd) {
    const raw = await readText(join(cwd, 'package.json'));
    if (raw === null) {
        return null;
    }
    let manifest;
    try {
        manifest = JSON.parse(raw);
    }
    catch (error) {
        throw new Error(`sideroom-dsh: invalid package.json in ${cwd}`, {
            cause: error,
        });
    }
    const scripts = typeof manifest === 'object' && manifest !== null
        ? manifest.scripts
        : undefined;
    if (typeof scripts !== 'object' || scripts === null) {
        return null;
    }
    const available = scripts;
    for (const name of SCRIPT_PRIORITY) {
        if (typeof available[name] === 'string') {
            const prefix = await managerPrefix(cwd);
            return { command: `${prefix} ${name}`, source: 'package.json' };
        }
    }
    return null;
}
export async function detectCheckCommand(cwd) {
    const fromScripts = await packageScriptCommand(cwd);
    if (fromScripts !== null) {
        return fromScripts;
    }
    if (await fileExists(join(cwd, 'go.mod'))) {
        return { command: 'go test ./...', source: 'go.mod' };
    }
    if (await fileExists(join(cwd, 'Cargo.toml'))) {
        return { command: 'cargo test', source: 'Cargo.toml' };
    }
    const pyproject = await fileExists(join(cwd, 'pyproject.toml'));
    const pytestIni = await fileExists(join(cwd, 'pytest.ini'));
    if (pyproject || pytestIni) {
        return { command: 'pytest -q', source: 'python' };
    }
    const makefile = await readText(join(cwd, 'Makefile'));
    if (makefile !== null && /^check:/m.test(makefile)) {
        return { command: 'make check', source: 'Makefile' };
    }
    return null;
}
