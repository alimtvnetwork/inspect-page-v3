# CI/CD Issues — Index

Summary of every CI/CD failure we've encountered and how it was resolved. New issues go to `.lovable/cicd-issues/XX-name.md` and get appended here.

| # | Issue | Status | File |
|---|-------|--------|------|
| 01 | `check-zip-freshness` reports `inspect-page-wp.zip` stale by ~0h | ✅ Resolved | [01-zip-freshness-stale-wp.md](cicd-issues/01-zip-freshness-stale-wp.md) |
| 02 | `bun run lint` in `extension/` → `eslint: command not found` (exit 127) | ✅ Resolved | [02-eslint-not-found-in-extension.md](cicd-issues/02-eslint-not-found-in-extension.md) |
| 03 | `bun run lint` at repo root → 7 ESLint errors (canvasW, no-danger, empty interfaces, require, debugger fixture) | ✅ Resolved | [03-eslint-7-errors-cleanup.md](cicd-issues/03-eslint-7-errors-cleanup.md) |
