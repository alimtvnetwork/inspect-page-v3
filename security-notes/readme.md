# security-notes/

Supply-chain pinning notes for dependencies with known CVE history.
Each note documents the minimum safe version + CI guard that enforces it.

| File | Scope | CI guard |
|---|---|---|
| `axios-pin.md` | npm `axios` (if ever added) | `scripts/ci/check-axios-version.mjs` |
| `wp-plugin-pin.md` | WordPress runtime + plugin deps | Manual review (no automated guard yet) |

Add a new note whenever a future dependency requires a version floor or vendor patch.