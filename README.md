# sideroom-dsh

Quality layer for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), ported from
[sideroom-pi](https://github.com/RMRdeveloper/sideroom-pi).

The agent has to load the coding rules before it edits, the lines it adds are checked mechanically, and a
turn cannot end silently after a mutation: it gets one review request that names the loaded guide and the
project checks.

Published as [`@rmrdeveloper/sideroom-dsh`](https://www.npmjs.com/package/@rmrdeveloper/sideroom-dsh).

## Status

Host-side port. Working today:

| Piece           | Behavior                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------- |
| Guidelines gate | `write` and `edit` are denied until the contract and the target language guide are loaded |
| Rule engine     | blocking and note rules over added lines only, with a per-rule circuit breaker            |
| Review          | one request at turn end, after a successful mutation                                      |
| Checks          | detects the project command, records green runs, feeds the review                         |
| Skills          | packaged sideroom skills plus an optional monorepo scan                                   |

Not ported yet: the TUI board, the edited-files strip, `sideroom_ask`, `jev`, and the browser companion.
`apply_patch` is not covered by the gate.

## How it behaves

### Guidelines gate

Before the first mutation of a run, the agent calls `sideroom_guidelines` with the target path. The tool
returns the shared contract plus the guide for that language and unlocks `write`/`edit` for the run. A full
`read` of the packaged asset also counts; partial reads (`offset`/`limit`) and failed reads do not. The
loaded set resets at the start of every turn, so a new run starts clean.

Unrecognized languages get the contract only. Set `guidelines.gateUnrecognized: true` to gate them too.

### Rules

Only the added lines are inspected. Two rules block; the rest are notes appended to the tool result:

- Block: braced conditionals, swallowed errors.
- Note: clear names, stale comments, commented-out code, debug artifacts.

A rule that blocks `degradeAfter` times in a run becomes a note until `resetAfter` clean checks, so the
agent cannot dead-lock on one rule.

### Review

After a successful `write` or `edit`, the next turn end carries one review request: re-check every changed
file against the loaded guide and run the relevant formatter, linter, type checks, and tests. It fires once
per turn. When `checks` already observed a green run of the project command, the review reuses it instead of
asking for a rerun.

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
          blocking: [braced-conditionals, swallowed-errors]
          notes: [clear-names, stale-comments, commented-code, debug-artifacts]
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
npm test
npm run check
```

`tsc` compiles `index.ts`, `src/`, and `test/` into `lib/`, and the bundle loads `lib/index.js`. `lib/` is
committed so the plugin works from a clone without a build step; run `npm run build` before committing
source changes.

`npm run check` runs the tests and then `check:pack`, which packs the tarball the way `npm publish` would,
asserts the file list, the patch row name, the locales, the icon and `engines.dsh`, and loads the entry
point from the extracted tarball.

## Releasing

Changesets plus GitHub Actions; CI publishes through npm trusted publishing. The runbook — first manual
publish, `npm trust`, the `npm` environment, and what to check afterwards — is in
[`docs/publishing.md`](docs/publishing.md).

## Attribution

MIT. Ported from [sideroom-pi](https://github.com/RMRdeveloper/sideroom-pi); [`NOTICE`](NOTICE) lists the
assets copied from the upstream package.
