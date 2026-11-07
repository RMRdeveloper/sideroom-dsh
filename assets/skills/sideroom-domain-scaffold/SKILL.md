---
name: sideroom-domain-scaffold
description: Build or complete the domain glossary in CONTEXT.md from existing code, without interviewing anyone. Use when asked to document a brownfield domain.
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom domain scaffold

The code is the source of truth: walk it, derive the domain's words, and merge them
into the glossary. Nobody is interviewed while the scan runs.

## Rules

- Zero interviews during the scan. Every irreconcilable conflict joins a **conflict
  list** and modeling continues.
- Scope is the central business domain: its modules, types, enums and statuses.
  Infrastructure, tooling and utilities are out. Domain tests witness the language;
  they are not a source of new terms.
- Reconcile by prevalence and centrality: the dominant, core-module usage wins. Record
  each call as an assumption for later review.
- Merge, never rebuild. An existing `CONTEXT.md` is curated truth: add and sharpen
  only. A contradiction with the code joins the conflict list; the entry stands.
- Entry format, glossary purity, lazy file creation and multi-context routing belong
  to `sideroom-domain-modeling`.
- Write no ADRs. Trade-offs cannot be validated without humans; hard choices found in
  the code are reported.

## Steps

1. Read `CONTEXT.md` and `CONTEXT-MAP.md` if present.
2. Survey the central domain code and collect candidate terms.
3. Group synonyms, split overloaded terms, reconcile by prevalence.
4. Write each settled term inline, merged with what exists.
5. Collect conflicts and assumptions as they appear.
6. Close with the glossary and the assumptions, then grill the conflict list once
   through `sideroom-grill`. With an empty list, state that the model came out clean.

## Output

A merged `CONTEXT.md` the code agrees with, and a reviewable list of assumptions. The
grill at the end is bounded to the conflict list.
