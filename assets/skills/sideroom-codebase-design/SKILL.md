---
name: sideroom-codebase-design
description: Shared vocabulary for designing deep modules. Use when a module's interface, depth, seam or testability is the question.
license: MIT
metadata:
  author: RMRdeveloper
---

# Sideroom codebase design

Design **deep modules**: a lot of behavior behind a small interface, at a clean seam,
testable through that interface. Use these words wherever code is designed or
restructured, and use them exactly: a synonym costs the reader the definition again.

## The terms

| Term | Meaning | Avoid |
| --- | --- | --- |
| **Module** | Anything with an interface and an implementation. Scale-agnostic: a function, class, package, or tier-spanning slice. | unit, component, service |
| **Interface** | Everything a caller must know to use the module: the type signature, invariants, ordering, error modes, configuration, and the relevant performance. | API, signature |
| **Implementation** | The code inside the module. Distinct from adapter: a small adapter can hold a large implementation. | — |
| **Depth** | Leverage at the interface: the useful behavior a caller or test gets per unit of interface learned. Deep is a lot behind a little; shallow is an interface as complex as its implementation. | — |
| **Seam** | A place where behavior can be replaced without editing there (Michael Feathers). The location where an interface lives. | boundary |
| **Adapter** | A concrete thing that satisfies an interface at a seam. Names a role, not a substance. | — |
| **Leverage** | What callers get from depth: more capability per unit of interface learned. One implementation pays back across many call sites and tests. | — |
| **Locality** | What maintainers get from depth: change, bugs, knowledge and verification concentrate in one place instead of spreading across callers. | — |

Respect the project's own domain words, in `CONTEXT.md` or its equivalent. These terms
describe a module's shape; they never rename a business concept.

## What follows

- Depth is a property of the interface, not of the implementation size. A deep module
  can be built internally from small, swappable parts; they are just not part of the
  interface.
- The **deletion test**: imagine deleting the module. If complexity vanishes, it was a
  pass-through; if it reappears across callers, it was earning its keep.
- The interface is the test surface. Callers and tests cross the same seam, so needing
  to test past the interface is a sign the module is the wrong shape.
- One adapter is a hypothetical seam; two make it real. Add a seam when something
  actually varies across it, not to anticipate variation.

## Going deeper

- [references/deepening.md](references/deepening.md): the four dependency categories,
  the form each recommendation takes, and how tests move when a module deepens.
- [references/design-it-twice.md](references/design-it-twice.md): parallel sub-agents,
  each designing a radically different interface, compared on depth, locality and seam
  placement.

In text the user reads, use an everyday word unless a design term decides something,
and explain the term once.
