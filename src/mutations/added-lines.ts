export function addedLines(before: string | null, after: string): string[] {
  const previous = new Set(
    before === null ? [] : before.split(/\r?\n/).map((line) => line.trim())
  )
  return after
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !previous.has(line.trim()))
}
