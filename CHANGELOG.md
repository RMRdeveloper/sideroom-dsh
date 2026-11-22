# Changelog

## 0.5.2

### Patch Changes

- 37c5ebb: Split the Jev client into `src/client/` modules built with esbuild into the single `client.js`
  artifact, render the dialog with the harness UI primitives, and keep the masked credential preview
  inside the dialog width instead of overflowing the card.
- 37c5ebb: Read the credential seam when the Jev key is resolved instead of capturing it while the plugin applies, so a stored key is found even when the credentials service finishes activating after this plugin.

## 0.5.1

### Patch Changes

- c4c9f84: Report the Jev key as `Missing` once the credential state resolves without a stored entry, instead of
  leaving the key badge on `Reading`, and share one vocabulary between the status rows and the report tones.

## 0.5.0

### Minor Changes

- 77752b4: Rework the Jev key dialog. The key section names the credential source, reveals a pasted key on demand,
  confirms a removal, reports every successful write, and hides the write controls when the environment
  variable or a read-only store owns the key. The status section renders `/jev status` as labelled rows with
  the hint below, keeps the raw text only as a fallback, and no longer reports a Host failure before a
  conversation exists. Visible focus rings, a focus trap and a restored focus replace the invisible
  `--dsw-focus-ring-color`, and the page behind the dialog no longer scrolls.

## 0.4.0

### Minor Changes

- c91aeaa: Add the optional Jev review: TypeSafe's classifier judges the rules no mechanical check can
  decide and delivers advisory notes that ride an existing result instead of an extra turn.
  
  - New `jev` configuration section, off by default. The key comes from `keyEnv` or the
    profile's credential store; without it no request is made.
  - Changed code is reviewed once per successful mutation with the complete body, the added
    lines and bounded related source read through `ctx.fs`. One global gate question
    suppresses the specific findings, the strongest notes are capped per turn, and the same
    rule on the same file is noted once per turn.
  - `exit_plan_mode`, `ask_user_question` and `todo_write` are reviewed too, with their notes
    appended to the tool result. A task note requires a newly completed item and an observed
    failed check.
  - Every failure is fail-open: timeout, network error, three consecutive transient failures,
    quota, a rejected key or a rate limit never touch the turn.
  - `calibrate` measures acceptance per rule and mutes a rule whose acceptance stays below
    20% after ten samples.
  - The Web client gets a Jev chip in the conversation composer dock: key state, a masked
    field that writes the key to the profile's credential store, and an on-demand status
    report. A `/jev` command prints the same report from any client and never includes the
    key value.

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
