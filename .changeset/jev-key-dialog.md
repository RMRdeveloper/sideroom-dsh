---
'@rmrdeveloper/sideroom-dsh': minor
---

Rework the Jev key dialog. The key section names the credential source, reveals a pasted key on demand,
confirms a removal, reports every successful write, and hides the write controls when the environment
variable or a read-only store owns the key. The status section renders `/jev status` as labelled rows with
the hint below, keeps the raw text only as a fallback, and no longer reports a Host failure before a
conversation exists. Visible focus rings, a focus trap and a restored focus replace the invisible
`--dsw-focus-ring-color`, and the page behind the dialog no longer scrolls.
