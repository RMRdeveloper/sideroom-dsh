import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promptSections } from '@/prompt.js';

const CONTRACT = `## Sideroom quality gate

Before the first \`write\` or \`edit\` in a run, call \`sideroom_guidelines\` with the target file path.
It returns the 20 canonical coding rules plus the guide for that language, and it is what unlocks
mutations: \`write\`/\`edit\` are denied until the matching guide is loaded in the current run.

After you change code, re-read the changed lines against the loaded guide — guard clauses, fail
fast, explicit errors, immutability, decomposition — and run the project formatter, linter, type
checks, and tests before you call the work done. Report the exact commands you ran.`;

const EXPLAIN = `## Explaining the work

After meaningful work, once the review and the checks are done, you may close your final response
with one short invitation to explain the changes or how to test them. Skip it for trivial work, when
you already explained, or when the user asked for no follow-up. Clarify the scope only when it is
genuinely unclear; otherwise explain directly.`;

test('both prompt sections are registered in order', () => {
  const sections = promptSections({ contract: true, explain: true });
  assert.deepEqual(
    sections.map((section) => [section.name, section.order]),
    [
      ['sideroom.contract', 900],
      ['sideroom.explain', 901],
    ],
  );
  assert.equal(sections[0].text, CONTRACT);
  assert.equal(sections[1].text, EXPLAIN);
});

test('a disabled prompt section is not registered', () => {
  const explainOnly = promptSections({ contract: false, explain: true });
  assert.deepEqual(
    explainOnly.map((section) => section.name),
    ['sideroom.explain'],
  );
  assert.equal(explainOnly[0].text, EXPLAIN);
  assert.deepEqual(promptSections({ contract: false, explain: false }), []);
  assert.deepEqual(
    promptSections({ contract: true, explain: false }).map(
      (section) => section.name,
    ),
    ['sideroom.contract'],
  );
});
