import type { PromptSettings } from '@/config.js';

export interface PromptSection {
  name: string;
  order: number;
  text: string;
}

const CONTRACT_TEXT = `## Sideroom quality gate

Before the first \`write\` or \`edit\` in a run, call \`sideroom_guidelines\` with the target file path.
It returns the 20 canonical coding rules plus the guide for that language, and it is what unlocks
mutations: \`write\`/\`edit\` are denied until the matching guide is loaded in the current run.

After you change code, re-read the changed lines against the loaded guide — guard clauses, fail
fast, explicit errors, immutability, decomposition — and run the project formatter, linter, type
checks, and tests before you call the work done. Report the exact commands you ran.`;

const EXPLAIN_TEXT = `## Explaining the work

After meaningful work, once the review and the checks are done, you may close your final response
with one short invitation to explain the changes or how to test them. Skip it for trivial work, when
you already explained, or when the user asked for no follow-up. Clarify the scope only when it is
genuinely unclear; otherwise explain directly.`;

export function promptSections(settings: PromptSettings): PromptSection[] {
  const sections: PromptSection[] = [];
  if (settings.contract) {
    sections.push({
      name: 'sideroom.contract',
      order: 900,
      text: CONTRACT_TEXT,
    });
  }
  if (settings.explain) {
    sections.push({ name: 'sideroom.explain', order: 901, text: EXPLAIN_TEXT });
  }
  return sections;
}
