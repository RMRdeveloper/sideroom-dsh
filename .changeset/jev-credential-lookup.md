---
'@rmrdeveloper/sideroom-dsh': patch
---

Read the credential seam when the Jev key is resolved instead of capturing it while the plugin applies, so a stored key is found even when the credentials service finishes activating after this plugin.
