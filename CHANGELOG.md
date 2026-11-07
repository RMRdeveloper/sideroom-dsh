# Changelog

## 0.3.0

### Minor Changes

- 5ae6d64: Split the architecture review into `sideroom-codebase-design` (vocabulary) and
  `sideroom-improve-architecture` (finder), move the deepening and design-it-twice techniques into references,
  and rewrite every skill for a shorter pointer, one owner per rule, and no harness mechanics in the body.

### Patch Changes

- 5ae6d64: Keep the Matt Pocock attribution in `README.md` alone: drop `NOTICE` and the per-skill `LICENSE.txt` files,
  and rename the root `LICENSE` to `LICENSE.txt`.

## 0.2.0

### Minor Changes

- 5906588: Cover `apply_patch` and `str_replace_editor` in the guidelines gate and the rules, send the review at the
  end of the turn, confirm check commands exactly per directory, and add the `explicit-any` and
  `suppressed-type-errors` rules.

## 0.1.0

### Minor Changes

- Initial release: the guidelines gate over `write` and `edit`, the rule engine over added lines with a
  per-rule circuit breaker, the end-of-turn review request, project check detection, and the packaged
  sideroom skills plus the optional monorepo scan.
