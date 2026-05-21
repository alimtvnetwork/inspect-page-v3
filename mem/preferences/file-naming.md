---
name: File naming convention (extension-src)
description: kebab-case for all .ts files in extension-src/; PascalCase for .tsx React components only. Enforced by M2/M3 sweep.
type: preference
---
**Rule:** Every `.ts` file under `extension-src/` MUST be kebab-case (e.g. `keep-alive.ts`, `run-full-page-export.ts`, `collect-element-snapshot.ts`). Only `.tsx` React component files stay PascalCase (e.g. `ExportPanel.tsx`, `MultiPickChips.tsx`).

**Why:** Consistency, easier grep, matches the WP plugin and broader JS ecosystem norm. The M2/M3 sweep renamed 83 files and rewrote ~74 import sites to enforce this.

**How to apply:**
- New non-component module → kebab-case filename.
- Test files mirror their source: `keep-alive.test.ts` for `keep-alive.ts`.
- React component files (PascalCase exported component) keep `.tsx` PascalCase.
- Bare side-effect imports (`import "./foo";`) follow the same rule — easy to miss in automated sweeps.
- Path alias imports (`@shared/...`, `@element/...`, etc.) resolve case-sensitively on Linux; never rely on case fallback.
