export function isBlank(line: string): boolean {
  return line.trim() === ''
}

export function isLineComment(line: string): boolean {
  return line.startsWith('//') || line.startsWith('#')
}

export function closingParen(text: string, open: number): number {
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    const character = text[index]
    if (character === '(') {
      depth += 1
    } else if (character === ')') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

export function nextMeaningful(lines: string[], from: number): string | null {
  for (let index = from; index < lines.length; index += 1) {
    const text = lines[index].trim()
    if (text !== '') {
      return text
    }
  }
  return null
}

export function blockBody(lines: string[], from: number): string[] {
  const body: string[] = []
  for (let index = from; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (trimmed.startsWith('}')) {
      break
    }
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('*')) {
      continue
    }
    body.push(trimmed)
  }
  return body
}
