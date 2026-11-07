export interface MaskOptions {
  keepComments: boolean;
}

type MaskState
  = | 'code'
    | 'line-comment'
    | 'block-comment'
    | 'single'
    | 'double'
    | 'template';

function isQuoteEnd(state: MaskState, character: string): boolean {
  if (state === 'single') {
    return character === '\'';
  }
  if (state === 'double') {
    return character === '"';
  }
  return state === 'template' && character === '`';
}

export function maskCode(
  lines: readonly string[],
  options: MaskOptions,
): string[] {
  let state: MaskState = 'code';
  const masked: string[] = [];
  for (const line of lines) {
    let output = '';
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const next = line[index + 1];
      if (state === 'code') {
        if (character === '/' && next === '/') {
          state = 'line-comment';
          output += options.keepComments ? '//' : '  ';
          index += 1;
          continue;
        }
        if (character === '/' && next === '*') {
          state = 'block-comment';
          output += options.keepComments ? '/*' : '  ';
          index += 1;
          continue;
        }
        if (character === '\'') {
          state = 'single';
          output += ' ';
          continue;
        }
        if (character === '"') {
          state = 'double';
          output += ' ';
          continue;
        }
        if (character === '`') {
          state = 'template';
          output += ' ';
          continue;
        }
        output += character;
        continue;
      }
      if (state === 'line-comment') {
        output += options.keepComments ? character : ' ';
        continue;
      }
      if (state === 'block-comment') {
        output += options.keepComments ? character : ' ';
        if (character === '*' && next === '/') {
          output += options.keepComments ? '/' : ' ';
          index += 1;
          state = 'code';
        }
        continue;
      }
      if (character === '\\') {
        output += ' ';
        index += 1;
        continue;
      }
      if (isQuoteEnd(state, character)) {
        state = 'code';
        output += ' ';
        continue;
      }
      output += ' ';
    }
    if (state === 'line-comment') {
      state = 'code';
    }
    masked.push(output);
  }
  return masked;
}
