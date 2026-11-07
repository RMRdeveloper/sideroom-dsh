# Design it twice

For a chosen candidate, design the interface more than once. The first idea is rarely
the best one.

## Frame it

Before spawning anything, write the problem space for the user: the constraints any
interface must satisfy, the dependencies and their category from
[deepening.md](deepening.md), and a rough sketch that makes the constraints concrete.
Show it, then start the sub-agents; the user reads while they work.

## Spawn

Three or more sub-agents in parallel, each with its own brief (paths, coupling,
dependency category, what sits behind the seam) and a different constraint:

- Minimize the interface: one to three entry points, with the most leverage each.
- Maximize flexibility: many use cases and room to extend.
- Optimize for the most common caller: the default case is trivial.
- Design around ports and adapters, when the dependency is remote.

Each returns the interface with its invariants and error modes, a usage example, what
the implementation hides, the dependency strategy with its adapters, and the trade-offs.

## Compare

Present the designs one at a time so each can be absorbed, then compare them on
**depth**, **locality** and **seam placement**. Recommend one and say why. When parts of
different designs combine well, propose the hybrid.
