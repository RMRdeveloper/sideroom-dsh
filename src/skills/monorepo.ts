import { readdir, readFile, lstat } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  SkillCandidate,
  SkillDefinition,
  SkillLookupOptions,
  SkillProvider,
  SkillProviderControl,
  SkillProviderObservation,
} from '@deepseek-ai/dsh-skill'
import { isMissingPathError } from '../errors.js'
import { parseFrontmatter } from './frontmatter.js'

const PROVIDER_NAME = 'sideroom-monorepo'

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'vendor',
  'target',
  'out',
])

const SKILL_ROOTS: Array<{ segment: string; baseRank: number }> = [
  { segment: join('.dsh', 'skills'), baseRank: 120 },
  { segment: join('.agents', 'skills'), baseRank: 220 },
]

interface Locator {
  path: string
  rank: number
}

interface DirectoryAtDepth {
  path: string
  depth: number
}

async function childDirectories(directory: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (isMissingPathError(error)) {
      return []
    }
    throw new Error(`sideroom-dsh: cannot list ${directory}`, { cause: error })
  }
  const children: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue
    }
    if (entry.name.startsWith('.') || SKIPPED_DIRECTORIES.has(entry.name)) {
      continue
    }
    children.push(join(directory, entry.name))
  }
  return children
}

async function directoriesAtDepth(
  root: string,
  maxDepth: number
): Promise<DirectoryAtDepth[]> {
  const visited: DirectoryAtDepth[] = []
  let frontier: string[] = [root]
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const next: string[] = []
    for (const directory of frontier) {
      next.push(...(await childDirectories(directory)))
    }
    if (next.length === 0) {
      break
    }
    for (const directory of next) {
      visited.push({ path: directory, depth })
    }
    frontier = next
  }
  return visited
}

async function skillFiles(skillsDirectory: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(skillsDirectory, { withFileTypes: true })
  } catch (error) {
    if (isMissingPathError(error)) {
      return []
    }
    throw new Error(`sideroom-dsh: cannot list ${skillsDirectory}`, {
      cause: error,
    })
  }
  const files: string[] = []
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(join(skillsDirectory, entry.name))
      continue
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue
    }
    const bundle = join(skillsDirectory, entry.name, 'SKILL.md')
    try {
      const stats = await lstat(bundle)
      if (stats.isFile()) {
        files.push(bundle)
      }
    } catch (error) {
      if (isMissingPathError(error)) {
        continue
      }
      throw new Error(`sideroom-dsh: cannot inspect ${bundle}`, {
        cause: error,
      })
    }
  }
  return files
}

async function readSkillFile(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if (isMissingPathError(error)) {
      return null
    }
    throw new Error(`sideroom-dsh: cannot read skill file ${file}`, {
      cause: error,
    })
  }
}

async function candidateFor(
  file: string,
  rank: number
): Promise<SkillCandidate | null> {
  const text = await readSkillFile(file)
  if (text === null) {
    return null
  }
  const parsed = parseFrontmatter(text)
  const name = parsed.fields.name
  const description = parsed.fields.description
  if (name === undefined || description === undefined) {
    return null
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
    locator: { path: file, rank } satisfies Locator,
  }
}

export function createMonorepoProvider(
  maxDepth: number
): (control: SkillProviderControl) => SkillProvider {
  return () => ({
    name: PROVIDER_NAME,

    async list(options: SkillLookupOptions): Promise<SkillProviderObservation> {
      const root = options.cwd ?? process.cwd()
      const directories = await directoriesAtDepth(root, maxDepth)
      const found: SkillCandidate[] = []
      const seen = new Set<string>()

      for (const directory of directories) {
        for (const skillRoot of SKILL_ROOTS) {
          const files = await skillFiles(
            join(directory.path, skillRoot.segment)
          )
          for (const file of files) {
            const candidate = await candidateFor(
              file,
              skillRoot.baseRank + directory.depth * 10
            )
            if (candidate === null || seen.has(candidate.name)) {
              continue
            }
            seen.add(candidate.name)
            found.push(candidate)
          }
        }
      }

      return { candidates: found, complete: true }
    },

    async get(candidate: SkillCandidate): Promise<SkillDefinition | undefined> {
      const locator = candidate.locator as Locator
      const text = await readSkillFile(locator.path)
      if (text === null) {
        return undefined
      }
      const parsed = parseFrontmatter(text)
      return {
        name: candidate.name,
        description: candidate.description,
        whenToUse: candidate.whenToUse,
        content: parsed.body.trim(),
        path: locator.path,
        source: candidate.source,
        invocation: candidate.invocation,
        provider: PROVIDER_NAME,
      }
    },
  })
}
