import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { guideFileFor } from '../languages.js'
import { parseFrontmatter } from '../skills/frontmatter.js'

export interface Guides {
  load(language: string): string
}

export function createGuides(packageRoot: string): Guides {
  const skillDirectory = join(
    packageRoot,
    'assets',
    'skills',
    'sideroom-guidelines'
  )
  const contractFile = join(skillDirectory, 'SKILL.md')
  const languagesDirectory = join(skillDirectory, 'references', 'languages')
  const cache = new Map<string, string>()

  function read(path: string): string {
    const cached = cache.get(path)
    if (cached !== undefined) {
      return cached
    }
    let text: string
    try {
      text = readFileSync(path, 'utf8')
    } catch (error) {
      throw new Error(`sideroom-dsh: cannot read guideline asset ${path}`, {
        cause: error,
      })
    }
    const normalized = text.replace(/^\uFEFF/, '')
    cache.set(path, normalized)
    return normalized
  }

  const contract = parseFrontmatter(read(contractFile)).body.trim()

  function load(language: string): string {
    const guideName = guideFileFor(language)
    if (guideName === null) {
      return contract
    }
    const addendum = read(join(languagesDirectory, `${guideName}.md`))
    return `${contract}\n\n---\n\n${addendum.trim()}`
  }

  return { load }
}
