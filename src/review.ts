import { randomUUID } from 'node:crypto';
import type { UserMessage } from '@deepseek-ai/dsh-llm';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'sideroom-review': {
      kind: 'sideroom-review';
    };
  }
}

export interface ReviewCheck {
  command: string | null;
  green: boolean;
}

export function reviewText({ command, green }: ReviewCheck): string {
  const review = `Sideroom review — before calling this done:

1. Re-read every file you changed in this run against the guidelines you loaded. Structural rules
   3, 4, 7, 8, 9, 10 and 20 and architectural rules 11-18 need judgment, not a linter.
2. Run the project formatter, linter, type checks, and tests that apply to the files you touched.
3. Report the exact commands and their outcome. If a check fails, fix it before you finish.`;
  if (green && command !== null) {
    return `${review}

Checks already green this run: \`${command}\`. Reuse that result instead of running it again; rerun only what this edit could have affected.`;
  }
  if (command !== null) {
    return `${review}

Detected check command: \`${command}\`.`;
  }
  return review;
}

export function reviewMessage(text: string): UserMessage {
  const content = Object.freeze([
    Object.freeze({ type: 'text' as const, text }),
  ]);
  const message: UserMessage = {
    id: randomUUID() as UserMessage['id'],
    role: 'user',
    content,
    source: Object.freeze({ kind: 'sideroom-review' as const }),
  };
  return Object.freeze(message);
}
