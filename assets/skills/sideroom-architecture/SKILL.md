---
name: sideroom-architecture
description: Resolve an architectural choice before code: boundaries, data ownership, contracts, failure, operations, cost. Use when a change forces one the repository has not settled.
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom architecture

Name the architectural decisions a change forces, and settle the ones that matter
before the code picks them by default.

## What counts

A decision is **architectural** when it moves module boundaries, data ownership,
integration contracts, failure behavior, quality attributes, operations, cost,
lock-in, or the cost of changing course later.

A decision the repository settles consistently is a **project fact**: reuse it. When
two inconclusive patterns compete, name the inconsistency in the prompt instead of
choosing one.

Clear requirements do not settle the architecture, even when the choice is
reversible.

## Ask

Pick the dimensions this change touches; two sharp questions beat nine shallow ones. A
dimension the change does not touch is not asked.

| Dimension | The question it forces |
| --- | --- |
| Boundaries | Which modules are in, which are out, which dependency direction is forbidden |
| Data | What is the source of truth, who owns it, how the schema evolves and migrates |
| Integration | Synchronous or asynchronous, backward compatibility, version window |
| Quality attributes | Expected latency and volume, availability target — in figures |
| Failure | What degrades, what retries, what must be idempotent |
| Operations | How it deploys, how it rolls back, which signal warns it is going wrong |
| Cost and lock-in | Operating cost, the cost of leaving the provider or dependency |
| Ownership | Who maintains it, who responds when it breaks |
| Reversibility | What reopens the decision, and how expensive undoing it is |

Every option carries a description: its practical consequence, its cost, and the
obligation it imposes. A one-word technology label is not an option.

Present the situation, the alternatives by consequence, and one recommendation with a
one-line justification. The bar is the one `sideroom-grill` sets: maintainability and
known growth over the cheapest first build, with the upfront and future cost named.

Quantify a dimension only when a number would change the decision; close the rest
with an explicit **out of scope**. Ask for a figure that could flip the choice before
recommending one.

One open architectural dimension blocks implementation.

## Record

Qualifying decisions go to `sideroom-domain-modeling`, which owns the three-gate ADR
offer and writes `docs/adr/`. The ADR names the rejected alternatives and what reopens
the decision.

## Output

Before the first round: one line on what is built, what it touches, what is out.
After: each decision closed with its figures, the dimensions marked out of scope, and
the ADR written. No architectural default reaches the code without being asked or read
from the repository.
