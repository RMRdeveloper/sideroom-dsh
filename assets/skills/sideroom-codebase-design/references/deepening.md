# Deepening

How to deepen a cluster of shallow modules given its dependencies. Assumes the
vocabulary in [SKILL.md](../SKILL.md): module, interface, seam, adapter.

## Dependency categories

Classify the candidate's dependencies first. The category decides how the deepened
module is tested across its seam.

| Category | What it is | How it deepens |
| --- | --- | --- |
| In-process | Pure computation, in-memory state, no I/O | Merge the modules and test through the new interface |
| Local-substitutable | A dependency with a local stand-in, such as PGLite or an in-memory filesystem | Deepen once the stand-in runs in the suite; the seam stays internal |
| Remote but owned | Your own service across a network | Define a port at the seam: production takes an HTTP or queue adapter, tests an in-memory one |
| True external | A third party you do not control | Take it as an injected port; tests provide a mock adapter |

A recommendation names the shape, not only the benefit: "define a port at the seam,
implement an HTTP adapter for production and an in-memory adapter for tests, so the
logic sits in one deep module even though it is deployed across a network."

## Seam discipline

One adapter means a hypothetical seam; two mean a real one. Do not introduce a port
without two justified adapters, typically production and test.

A deep module can hold internal seams, private to its implementation and used by its
own tests.

## Tests move with the seam

Write the test at the deepened module's interface before deleting the old one. The old
unit tests become redundant once the interface covers their behavior, and a test that
only inspects a smaller function is not redundant by that reason alone.

New tests assert observable outcomes through the interface. A test that must change when
the implementation changes is testing past the interface, which is the seam to revisit.
