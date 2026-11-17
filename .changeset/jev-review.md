---
'@rmrdeveloper/sideroom-dsh': minor
---

Add the optional Jev review: TypeSafe's classifier judges the rules no mechanical check can
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
- The client status chip and masked key capture are not included; the key comes from the
  environment or the credential store.
