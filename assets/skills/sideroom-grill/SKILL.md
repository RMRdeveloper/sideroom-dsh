---
name: sideroom-grill
description: Interview an open plan in rounds until nothing is silently assumed. Use when the user wants to explore an idea or plan a non-trivial change.
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom grill

Ask in **rounds**: one batch of questions, then wait for the answers before the
next batch. Use the harness question tool when it has one (in DeepSeek Harness,
`ask_user_question`); otherwise ask in the conversation and wait.

## Fill a round

Bring only what the code cannot settle. Read the code first and reuse every
**project fact**. Take **minor decisions** yourself and say so. Expose the rest as
**architectural** and let `sideroom-architecture` carry the detail.

Every question carries a recommendation: the index of the option you would pick, or
at least one index when the question allows several. Write prompts and option labels
in the user's language; keep ids and values in English.

A recommendation weighs maintainability and room for known growth over the cheapest
first build, and names the upfront cost and the cost of changing course later.

When a missing figure could flip the choice, ask for it in a preliminary round whose
recommended option is to go and get it. An invented number is not a recommendation.

An **out of scope** answer closes its thread.

If the effort is too big to hold in one session, say so and stop.

## Close

Stop when no open term and no open decision remains, or the user cancels. State what
was settled, what was written, and the next step: a story for anything non-trivial,
implementation for what is small enough to build now.

`sideroom-domain-modeling` owns the writing: glossary entries inline in `CONTEXT.md`
and the ADR offer under `docs/adr/`. Everything else stays in the conversation, so the
session is handed forward rather than cleared.
