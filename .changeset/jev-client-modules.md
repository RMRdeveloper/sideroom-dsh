---
'@rmrdeveloper/sideroom-dsh': patch
---

Split the Jev client into `src/client/` modules built with esbuild into the single `client.js`
artifact, render the dialog with the harness UI primitives, and keep the masked credential preview
inside the dialog width instead of overflowing the card.
