---
name: sideroom-user-stories
description: Write, split or review a user story and its acceptance criteria. Use when a settled decision needs to become a story for product, development and QA.
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom user stories

Produce a story that product, development and QA read the same way, without
reconstructing the conversation. Write in the user's language and keep the project's
domain terms.

## Authority

Text in the conversation only. Saving a file, publishing or editing a ticket, setting
metadata or changing workflow state needs an explicit request. A story never
authorizes implementation, glossary edits or architectural decisions.

## Steps

1. **Read the facts.** Start with the brief or ticket, the project conventions, the
   glossary, approved specs and linked dependencies. Inspect code only to separate
   current behavior from the requested change; code does not establish product intent.
   Reuse local ticket conventions without importing another project's roles, boards,
   labels, estimates or priorities. Search the tracker for duplicates when it is
   available; otherwise say they were not checked, claim no uniqueness, and invent no
   issue key.
2. **Name the need.** State the actor who gets value, the capability, the useful
   result and the boundaries. Prefer one complete outcome over separate UI, API and
   persistence stories. Split outcomes that are valuable on their own, and keep each
   story's result clear. A technical enablement story names its consumer and the
   capability it enables.
3. **Resolve the material gaps.** Ask only about facts or decisions that change scope
   or acceptance. A story is a draft while a material question is open: mark it and
   list the questions separately. An answer that was not accepted is not a requirement,
   so a proposed permission, rule, metric, dependency or error response stays open.
4. **Draft it.** Read [templates](references/templates.md) first. The normal shape is
   a result-oriented title, the story sentence, the scope, and the acceptance criteria.
   Add a section only when it carries a real condition. For a bug, use the bug format
   instead of a story sentence.
5. **Review it.** Read [review guidance](references/review.md) first. Trace each
   criterion to the scope or a business rule, and remove work nobody asked for. Cover
   the successful path and the failure or boundary cases that change the result. The
   story is ready when every criterion has an objective pass or fail; when it is not,
   return the draft with its blockers instead of claiming readiness.

## Output

A review reports concrete ambiguities, missing outcomes and unsupported requirements,
with corrected wording and no silent scope growth. A split shows each story and the
real dependency between them.

Keep implementation steps, source paths, logs and routine commands out of the ticket.
Link an approved design decision and carry its behavioral consequence into the ticket.
Publish only on request: confirm the destination and metadata, check duplicates, and
state dependency links in the right direction, where the prerequisite blocks the
dependent. Report what was actually saved.
