---
name: sideroom-domain-modeling
description: Sharpen ambiguous domain terms into glossary entries in CONTEXT.md, and record a decision as an ADR when it is hard to reverse.
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom domain modeling

The words are the problem: one term with two meanings, one term doing several jobs,
or a statement that has to outlive the conversation. Reading `CONTEXT.md` to borrow a
word needs no skill.

## Settle a term

Interrupt when a term conflicts with the glossary: ask which of the two things is
meant. Force the precise word when a vague one appears where an exact one exists.

Stress-test a relationship with a concrete scenario until its boundaries are exact.
Cross-check the sentence against the code, quote the code back, and settle which is
right out loud before changing either.

A resolved term lands in `CONTEXT.md` the moment it resolves, inline, mid-conversation:
one or two sentences saying what the thing **is**, plus the rejected synonyms under
`_Avoid_`.

`CONTEXT.md` is a glossary and nothing else. Refuse implementation detail, spec prose
and scratch notes, and say why. In a repo with a `CONTEXT-MAP.md` at the root, terms go
into the per-context file the map points at.

Create files lazily: nothing exists until the first term or decision crystallises. Keep
the glossary lean; it gets shorter as often as it grows. Split an overloaded term, drop
a dead one, and offer to condense a file that absorbed detail that was never glossary
material.

When the module's shape is the problem, it is design. When the whole plan needs
interrogating, it is `sideroom-grill`.

## Offer an ADR

An ADR under `docs/adr/` is offered, never assumed, and only when three gates pass at
once: hard to reverse, surprising without context, and the result of a real trade-off.
When refusing, name the gate that failed.

The ADR names the rejected alternatives, the trade-off, and what reopens the decision.

## Before you finish

Re-read the entries you touched: each defines what a thing is, in one or two
sentences, with no implementation detail.
