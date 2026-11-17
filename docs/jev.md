# Jev review

Jev is TypeSafe's decision model: you send a state and typed questions, and it returns
probabilities, never prose. Sideroom asks it the guide questions that no mechanical check
can decide. Everything here is influenced by the model's answer and never blocks a tool.

## Configuration

```yaml
jev:
  enabled: false
  keyEnv: TYPESAFE_API_KEY
  endpoint: https://api.typesafe.ai/v1/systemone
  model: jev-latest
  cutoff: 0.8
  gate: 0.6
  maxNotes: 3
  timeoutMs: 3000
  maxRelatedFiles: 4
  scanForConsumers: false
  reviewPlans: true
  reviewWorkflows: true
  calibrate: false
```

| Key | Meaning |
| --- | --- |
| `enabled` | Off by default. Without it, or without a key, no request is made. |
| `keyEnv` | Environment variable that holds the key, and the credential reference used when it is absent. |
| `endpoint` | Service endpoint. |
| `model` | Model id. `jev-latest` moves; pin a version when the cutoff must stay calibrated. |
| `cutoff` | Minimum probability for a note. |
| `gate` | Minimum probability of the global "would a reviewer object" question; below it no note is emitted. |
| `maxNotes` | Notes carried per turn, strongest first. |
| `timeoutMs` | Per-request HTTP timeout. |
| `maxRelatedFiles` | Related files attached as evidence, and files read from a plan. |
| `scanForConsumers` | Opt in to a bounded workspace scan that finds files importing the changed module. |
| `reviewPlans` | Review the markdown passed to `exit_plan_mode`. |
| `reviewWorkflows` | Review `ask_user_question` batches and completed `todo_write` items. |
| `calibrate` | Mute rules whose measured acceptance is too low (see Calibration). |

The key is read from `keyEnv` and, when the variable is empty, from the profile's
credential store under the same name. The key never enters the session.

## What is sent

- **Code changes** — the changed file's complete body, the added lines, and up to
  `maxRelatedFiles` related source files (imports, sibling tests, and consumers only when
  the scan is enabled). All reads go through `ctx.fs`, so the file policy applies.
- **Plans** — the plan markdown plus files it mentions.
- **Questionnaires** — question ids, wording, options and recommendations.
- **Completed tasks** — only the items that moved to `completed` in that call, plus the
  observed check state (`passed`, `failed`, `unknown`).

Never sent: user answers, conversation history, command output, logs, configuration,
git history, environment values.

## Delivery

Notes are advisory and ride an existing result, so they cost no extra model turn. Code
notes ride the review, so they require `review.enabled`; plan, questionnaire and task
notes do not. `maxNotes` caps the code notes carried per turn; the other surfaces are
deduplicated per turn and delivered once:

| Surface | Delivered in |
| --- | --- |
| Code changes | The end-of-turn review message, with the checks status |
| Plan | The `exit_plan_mode` result |
| Questionnaire | The `ask_user_question` result |
| Completed tasks | The `todo_write` result |

Task notes are requested only when a newly completed item meets an observed failed
check; a missing or unknown check never counts as evidence of unfinished work.

## Client controls

The Web client renders a compact **Jev** chip in the conversation composer dock. The chip reports the key
state only (configured, missing or unavailable); it never claims that Jev is enabled or healthy.

Opening it shows a two-section dialog:

- **Key** — a badge reports the source: `Stored`, `Environment`, `Missing` or `Unavailable`, with the
  provider mask when the store exposes one. While the credential is writable, the dialog offers a password
  field with a Show/Hide toggle, `Save key` (enabled once a value is typed) and `Remove`, which asks for
  confirmation. A successful write answers with a notice and clears the field. When the key comes from the
  `keyEnv` environment variable the write controls are hidden: the variable wins over the store, so the
  dialog explains it instead of offering an action that would do nothing. The same applies to a read-only
  store (`writable: false`); when the key state cannot be read, the store error replaces the silent failure.
  Saving writes through `ctx.remote.credentials.set()` and removing calls `unset()`. The value travels from
  the browser to the Host and never enters the session, the configuration or a model request.
- **Status** — opening the dialog runs `/jev status` in the current session, so the report comes from the
  Host process. The report is rendered as labelled rows (enabled, reference, source, model, state, calls,
  cutoff, gate and muted rules) with the hint below; a report that does not parse falls back to its raw text.
  `Refresh` re-runs the command and reports while it waits. Without a conversation the dialog explains where
  the status comes from instead of reporting a Host failure. When the report names another `keyEnv`, the
  dialog switches the credential reference it reads and writes.

The chip reads the `TYPESAFE_API_KEY` reference until the first status report arrives.

## `/jev` command

| Invocation | Answer |
| --- | --- |
| `/jev` or `/jev status` | configuration, key source, model, guard state, call count and muted rules |
| `/jev help` | usage |

The report is line-oriented: `enabled:`, `keyEnv:`, `key:`, `model:`, `status:`, `calls:`, `cutoff:`,
`gate:` and `muted:`, plus a hint when the integration is off or has no key. It never includes the key
value. Each invocation is recorded in the session log like any other command.

## Failure policy

Any of these leaves the turn untouched: a request timeout, a network error, three
consecutive transient failures, quota (`402`), a rejected key (`401`/`403`). A rate
limit (`429`) pauses calls until the next turn. A successful call rearms the guard.

## Calibration

With `calibrate` on, a note counts as accepted when a later turn mutates the same file
it named. After at least ten samples, a rule whose acceptance rate is below 20% is muted
for the rest of the session. Plan, questionnaire and task notes are not measured: their
acceptance signal is not comparable to a file mutation.

## Limits

The service accepts 64k tokens per request and 32k per question. Without the service
tokenizer, the request is bounded conservatively at 64,000 and 32,000 UTF-8 bytes. A
changed file that does not fit is skipped; related files that do not fit are omitted
whole. The optional consumer scan stops after 1,024 files and ten directory levels.

## Privacy

Changing code sends source to a third-party API. Sensitive-named, hidden and ignored
paths are excluded from related source, but a normal source file can still contain a
secret. Keep `enabled` off unless that trade-off is acceptable.

## Client limits

- The chip does not toggle `jev.enabled`: changing an ordinary configuration field restarts the plugin, so
  the switch stays in the profile patch.
- The status is a snapshot. A quota or rate-limit failure appears on the next refresh, not live.
- The dialog never shows the key value: the store reports a mask, and an environment key is only named.
- Client text is localized to English and Spanish; other locales fall back to English.
