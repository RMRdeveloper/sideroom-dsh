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

## Not implemented yet

The client-side status chip and masked key capture (the Pi footer and `F10` screen) are
not ported. Until then the key comes from the environment or the credential store, and
the request counters are available only through the plugin's own metrics.
