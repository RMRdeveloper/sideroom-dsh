export interface ParsedFrontmatter {
  fields: Record<string, string>
  body: string
}

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (match === null) {
    return { fields: {}, body: text }
  }
  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (pair === null) {
      continue
    }
    fields[pair[1]] = pair[2].trim().replace(/^['"]/, '').replace(/['"]$/, '')
  }
  return { fields, body: text.slice(match[0].length) }
}

export function booleanField(
  fields: Record<string, string>,
  key: string,
  fallback: boolean
): boolean {
  const raw = fields[key]
  if (raw === undefined) {
    return fallback
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true
  }
  if (normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false
  }
  if (normalized === '1') {
    return true
  }
  if (normalized === '0') {
    return false
  }
  return fallback
}
