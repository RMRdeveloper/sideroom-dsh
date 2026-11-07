# sideroom-dsh

Quality layer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), ported from
[sideroom-pi](https://github.com/RMRdeveloper/sideroom-pi).

The agent has to load the coding rules before it edits, the lines it adds are checked mechanically, and a
turn cannot end silently after a mutation: it gets one review request that names the loaded guide and the
project checks.

Published as [`@rmrdeveloper/sideroom-dsh`](https://www.npmjs.com/package/@rmrdeveloper/sideroom-dsh).

## Status

Host-side port. Working today:

| Piece           | Behavior                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Guidelines gate | `write`, `edit`, `apply_patch`, and `str_replace_editor` are denied until the contract and every target guide are loaded |
| Rule engine     | blocking and note rules over added lines only, with a per-rule circuit breaker                                      |
| Review          | one request at turn end, after a successful mutation, carrying the checks status                                    |
| Checks          | detects the project command, confirms the exact command in its own directory, feeds the review                      |
| Skills          | packaged sideroom skills plus an optional monorepo scan                                                             |

Not ported yet: the TUI board, the edited-files strip, `sideroom_ask`, `jev`, the browser companion,
`sideroom_research`, and the active half of persona (`sideroom_persona`, the always-on reminder and the
prose and artifact enforcement). The persona guide itself is packaged and registered as a skill.

## How it behaves

### Guidelines gate

Before the first mutation of a turn, the agent calls `sideroom_guidelines` with a target path. The tool
returns the shared contract plus the guide for that language and unlocks the mutation tools for the turn.
Only that tool counts: a full `read` of the packaged asset is not observed, and a failed or partial load
does not unlock anything. The loaded set resets when the turn changes, so a new turn starts clean.

`apply_patch` and `str_replace_editor` use the same gate and rules. A multi-file patch lists every target
whose guide is missing, and a blocking line names the file it came from.

Unrecognized languages get the contract only. Set `guidelines.gateUnrecognized: true` to gate them too;
the rules still run only for known languages.

### Rules

Only the added lines are inspected. Three rules block; the rest are notes appended to the tool result:

- Block: braced conditionals, explicit `any`, swallowed errors.
- Note: clear names, stale comments, commented-out code, debug artifacts, suppressed type errors
  (`@ts-ignore` and `@ts-nocheck`; `@ts-expect-error` is allowed).

Strings and comments are masked before the TypeScript checks, so `'any'`, `anyValue`, and a comment that
mentions `@ts-ignore` do not count. A rule that blocks `degradeAfter` times in a turn becomes a note until
`resetAfter` clean checks, so the agent cannot dead-lock on one rule.

`apply_patch` checks the lines its hunks add, per file. `str_replace_editor` checks `create`, `str_replace`,
and `insert`; `view` is not a mutation.

### Review

After a successful mutation, the next turn end sends one steering message: re-check every changed file
against the loaded guide and run the relevant formatter, linter, type checks, and tests. It fires once per
turn. When `checks` observed a green run of the detected command after the latest mutation in that
directory, the review reuses it instead of asking for a rerun.

The review is skipped when the turn is aborted, and it is cleared when the next turn starts, so a mutation
from an earlier turn never produces a late review.

### Checks

The tracker detects the project command from `package.json` and the lockfile (`check` → `test` → `lint` →
`typecheck` → `types`), `pytest -q` from `pyproject.toml`, `setup.py`, or `pytest.ini`, `go test ./...` from
`go.mod`, `cargo test` from `Cargo.toml`, and `make check` from a `Makefile`.

A result turns green only when the shell text matches the detected command exactly after collapsing
horizontal whitespace, in that directory, and the command started after the latest mutation there. Extra
arguments, `cd other && ...`, newlines, and joined commands are not confirmed. A failed rerun clears green,
and a mutation invalidates it. State is kept per directory; a new turn forgets it.

## Install

Requires DeepSeek Harness `0.2.2-rc.1` or a later `0.2.x` release. The manifest declares
`engines.dsh` as `>=0.2.2-rc.1 <0.3.0-0`, so the Harness refuses the bundle on a version it was not built
against instead of loading it half-broken.

### From the app

**Plugins → Add plugin**, paste `@rmrdeveloper/sideroom-dsh`, then **Install**. Switch the bundle on if it
stays off (**Enable now**). The Plugin manager writes the profile dependency and the bundle selection for
you; with HMR the bundle loads without a restart.

### From the CLI

For a profile the `dsh` CLI owns (`web`, `headless`, or a custom profile):

```bash
dsh plugin --profile web add @rmrdeveloper/sideroom-dsh
```

`dsh plugin add` forwards to pnpm in that profile. Select the bundle afterwards — from the Plugins page, or
by adding `@rmrdeveloper/sideroom-dsh` to `dsh.profile.bundles` in the profile's `package.json` — and
restart the profile when it does not use HMR. The `desktop` profile belongs to the Desktop app, so manage
that one from the app itself.

## Configuration

The bundle patch ships these defaults:

```yaml
- insert:
    - id: sideroom
      name: '@rmrdeveloper/sideroom-dsh'
      config:
        guidelines: { enabled: true, gateUnrecognized: false }
        rules:
          enabled: true
          blocking: [braced-conditionals, explicit-any, swallowed-errors]
          notes:
            - clear-names
            - stale-comments
            - commented-code
            - debug-artifacts
            - suppressed-type-errors
          degradeAfter: 3
          resetAfter: 5
        review: { enabled: true }
        prompt: { contract: true, explain: true }
        checks: { enabled: true }
        skills: { enabled: true, packaged: true, monorepo: true, maxDepth: 3 }
```

Every block is optional; the defaults above apply to missing keys. Unknown keys warn, and a wrong type
fails the bundle at load instead of silently disabling a gate.

## Development

```bash
npm install
npm run build
npm run lint
npm run lint:fix
npm test
npm run check
npm run mutation
```

`npm run mutation` builds and runs Stryker over the compiled `lib/` with the TAP runner and per-test
coverage. The report lands in `reports/` (ignored), and the 100% break threshold makes the run fail while
any mutant survives.

All internal imports use the `@/*` alias (`@/config.js`), declared in `tsconfig.json` through `baseUrl`
and `paths`. `tsc` does not rewrite path mappings, so the build runs `tsc-alias` after `tsc`; the compiled
`lib/` uses relative imports and the plugin keeps working on plain Node.

`tsc` compiles `index.ts` and `src/` into `lib/`, and the bundle loads `lib/index.js`. Tests live next to
the file they cover (`src/checks/tracker.test.ts`, `index.test.ts`) and compile to `lib/**/*.test.js`,
which is ignored and excluded from the package. `lib/` is committed so the plugin works from a clone
without a build step; run `npm run build` before committing source changes.

`npm run lint` runs ESLint with the type-aware rules, `@stylistic` formatting, and `no-comments`. The
Husky `pre-commit` hook runs `eslint --fix` through `lint-staged` on every commit, so staged `.ts` and
`.mjs` files are fixed before the commit lands.

`npm run check` runs the type check, the lint, the tests, and then `check:pack`, which packs the tarball
the way `npm publish` would, asserts the file list, the patch row name, the locales, the icon and
`engines.dsh`, and loads the entry point from the extracted tarball.

## Releasing

Changesets plus GitHub Actions; CI publishes through npm trusted publishing. The runbook — first manual
publish, `npm trust`, the `npm` environment, and what to check afterwards — is in
[`docs/publishing.md`](docs/publishing.md).

## Attribution

MIT. Ported from [sideroom-pi](https://github.com/RMRdeveloper/sideroom-pi); [`NOTICE`](NOTICE) lists the
assets copied from the upstream package.
