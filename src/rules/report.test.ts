import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blockedReason,
  describeFinding,
  notesText,
} from '@/rules/report.js';
import type { Finding } from '@/rules/types.js';

const BRACED: Finding = {
  rule: 'braced-conditionals',
  line: 'if (!user) return 0;',
};

const CLEAR: Finding = {
  rule: 'clear-names',
  line: 'const data = rows;',
};

test('describeFinding labels a note with its rule metadata', () => {
  assert.equal(
    describeFinding(BRACED),
    '- [note] rule 1 Braced conditionals: wrap the body in braces so the statement cannot bind by indentation. Line: `if (!user) return 0;`',
  );
});

test('describeFinding supports the blocked and degraded labels', () => {
  assert.equal(
    describeFinding(BRACED, 'blocked'),
    '- [blocked] rule 1 Braced conditionals: wrap the body in braces so the statement cannot bind by indentation. Line: `if (!user) return 0;`',
  );
  assert.equal(
    describeFinding(BRACED, 'degraded'),
    '- [note (rule keeps firing)] rule 1 Braced conditionals: wrap the body in braces so the statement cannot bind by indentation. Line: `if (!user) return 0;`',
  );
});

test('describeFinding omits the number for a rule without one', () => {
  assert.equal(
    describeFinding({ rule: 'explicit-any', line: 'const value: any = 1;' }),
    '- [note] rule Explicit any: name the real type or narrow the value instead of using any. Line: `const value: any = 1;`',
  );
});

test('describeFinding handles a numeric comment rule', () => {
  assert.equal(
    describeFinding({ rule: 'suppressed-type-errors', line: '// @ts-ignore' }),
    '- [note] rule 19 Suppressed type errors: fix the type error or use @ts-expect-error with a reason; remove @ts-ignore and @ts-nocheck. Line: `// @ts-ignore`',
  );
});

test('blockedReason reports a single rule', () => {
  assert.equal(
    blockedReason({
      toolName: 'write',
      filePath: 'src/app.ts',
      blocks: [BRACED],
    }),
    'Sideroom blocked this write of src/app.ts: the lines you added break 1 guideline rule.\n- [blocked] rule 1 Braced conditionals: wrap the body in braces so the statement cannot bind by indentation. Line: `if (!user) return 0;`\nFix those lines and retry the same call. A rule that keeps firing degrades to a note instead of blocking again.',
  );
});

test('blockedReason pluralizes multiple rules', () => {
  const reason = blockedReason({
    toolName: 'edit',
    filePath: 'src/app.ts',
    blocks: [BRACED, CLEAR],
  });
  assert.match(reason, /break 2 guideline rules/);
  assert.match(reason, /Braced conditionals/);
  assert.match(reason, /Clear names/);
});

test('notesText labels a normal note', () => {
  assert.equal(
    notesText({ notes: [CLEAR], filePath: 'src/app.ts' }),
    'Sideroom notes for src/app.ts:\n- [note] rule 6 Clear names: name the role or the domain meaning instead of a generic placeholder. Line: `const data = rows;`',
  );
});

test('notesText labels a degraded note', () => {
  assert.equal(
    notesText({
      notes: [{ ...CLEAR, degraded: true }],
      filePath: 'src/app.ts',
    }),
    'Sideroom notes for src/app.ts:\n- [note (rule keeps firing)] rule 6 Clear names: name the role or the domain meaning instead of a generic placeholder. Line: `const data = rows;`',
  );
});

test('notesText keeps every note in order', () => {
  const text = notesText({
    notes: [BRACED, CLEAR],
    filePath: 'src/app.ts',
  });
  assert.match(text, /Braced conditionals[\s\S]*Clear names/);
});

test('blockedReason joins multiple findings with a newline', () => {
  const reason = blockedReason({
    toolName: 'edit',
    filePath: 'src/app.ts',
    blocks: [BRACED, CLEAR],
  });
  assert.match(
    reason,
    /Line: `if \(!user\) return 0;`\n- \[blocked\] rule 6 Clear names/,
  );
});

test('notesText joins multiple findings with a newline', () => {
  const text = notesText({ notes: [BRACED, CLEAR], filePath: 'src/app.ts' });
  assert.match(
    text,
    /Line: `if \(!user\) return 0;`\n- \[note\] rule 6 Clear names/,
  );
});
