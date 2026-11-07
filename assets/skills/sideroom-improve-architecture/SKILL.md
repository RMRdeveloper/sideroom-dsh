---
name: sideroom-improve-architecture
description: Scan a codebase for deepening opportunities and present them as candidates. Use when the codebase itself resists change.
disable-model-invocation: true
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom improve architecture

Find the modules worth deepening, and stop before designing them. This skill produces
candidates; the design starts once the user picks one.

## Scope before you scan

Deepening pays off where change keeps landing, so weight the recently changed code. If
the user named a module, a subsystem or a pain point, take it. Otherwise walk the
history (`git log --oneline`) and start where the commits cluster.

Read `CONTEXT.md` and any ADR in the area first. Surface an ADR the change would
contradict only when the friction is real enough to reopen it, and say so in the card.

## What friction looks like

Understanding one concept means bouncing between many small modules. A **shallow**
module has an interface nearly as complex as its implementation. Functions were
extracted for testability while the real bugs hide in how they are called, so there is
no **locality**. Modules leak across their seams. Parts of the code are untested, or
hard to test through the interface they expose.

Apply the **deletion test** to anything you suspect: would deleting it concentrate
complexity, or just move it?

For a growth concern, read [references/growth.md](references/growth.md) and separate
verified constraints from assumptions. File length, folder count and a missing pattern
are not findings on their own.

## Candidates

Present them as a table in the conversation, ranked by avoided defects and change cost.
The output is text: no HTML report, diagram or browser preview.

| Candidate | Files | Problem | What changes | Benefit | Strength |
| --- | --- | --- | --- | --- | --- |

`Strong` is demonstrated friction with a defensible remedy. `Worth exploring` means a
fact or an experiment is still missing, and it names that fact. `Speculative` marks an
unverified future concern, which becomes a measurement step rather than a task.

Close with one line: the candidate you would take first, and why.

Then stop and ask which one to explore. Proposing an interface here would skip the
choice this skill exists to offer.

## Design the chosen one

Load `sideroom-codebase-design` for the vocabulary: its deepening and design-it-twice
references carry the technique for this step. A meaningful trade-off compares genuinely
different interfaces, including keeping the current one. A routine improvement needs no
menu.

Classify each dependency and plan the migration in small steps, keeping callers working
and removing temporary compatibility only when it is safe.

Decisions that settle during the design stay with their owner: glossary terms and ADRs
through `sideroom-domain-modeling`, open product behavior through `sideroom-grill`, and
`sideroom-guidelines` before any edit. When the user asks to implement the improvement,
that is an ordinary change and follows the same route.

## Output

A prioritized candidate table in the conversation, a top recommendation, and either the
user's choice or an explicit statement that no structural improvement is justified.

After the design: the interface with its invariants, the constraints that must survive,
the migration with its rollback, the tests that carry it, and the facts still missing.
