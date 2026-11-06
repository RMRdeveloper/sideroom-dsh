import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMissingPathError } from '../errors.js';
import { booleanField, parseFrontmatter } from './frontmatter.js';
function readSkillFile(path) {
    try {
        return readFileSync(path, 'utf8');
    }
    catch (error) {
        if (isMissingPathError(error)) {
            return null;
        }
        throw new Error(`sideroom-dsh: cannot read skill file ${path}`, {
            cause: error,
        });
    }
}
export function createSkillCatalog(packageRoot) {
    const directory = join(packageRoot, 'assets', 'skills');
    let entries;
    try {
        entries = readdirSync(directory, { withFileTypes: true });
    }
    catch (error) {
        if (isMissingPathError(error)) {
            return [];
        }
        throw new Error(`sideroom-dsh: cannot list ${directory}`, { cause: error });
    }
    const registrations = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const skillDirectory = join(directory, entry.name);
        const file = join(skillDirectory, 'SKILL.md');
        const text = readSkillFile(file);
        if (text === null) {
            continue;
        }
        const parsed = parseFrontmatter(text);
        const name = parsed.fields.name ?? entry.name;
        const description = parsed.fields.description;
        if (description === undefined) {
            continue;
        }
        registrations.push({
            name,
            description,
            content: parsed.body.trim(),
            path: file,
            source: 'bundled',
            resourceBase: { kind: 'directory', path: skillDirectory },
            invocation: {
                modelInvocable: !booleanField(parsed.fields, 'disable-model-invocation', false),
                userInvocable: booleanField(parsed.fields, 'user-invocable', true),
            },
        });
    }
    return registrations;
}
