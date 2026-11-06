import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guideFileFor } from '../languages.js';
import { parseFrontmatter } from '../skills/frontmatter.js';
export function createGuides(packageRoot) {
    const skillDirectory = join(packageRoot, 'assets', 'skills', 'sideroom-guidelines');
    const contractFile = join(skillDirectory, 'SKILL.md');
    const languagesDirectory = join(skillDirectory, 'references', 'languages');
    const cache = new Map();
    function read(path) {
        const cached = cache.get(path);
        if (cached !== undefined) {
            return cached;
        }
        let text;
        try {
            text = readFileSync(path, 'utf8');
        }
        catch (error) {
            throw new Error(`sideroom-dsh: cannot read guideline asset ${path}`, {
                cause: error,
            });
        }
        const normalized = text.replace(/^\uFEFF/, '');
        cache.set(path, normalized);
        return normalized;
    }
    const contract = parseFrontmatter(read(contractFile)).body.trim();
    function load(language) {
        const guideName = guideFileFor(language);
        if (guideName === null) {
            return contract;
        }
        const addendum = read(join(languagesDirectory, `${guideName}.md`));
        return `${contract}\n\n---\n\n${addendum.trim()}`;
    }
    return { load };
}
