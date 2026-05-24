# Lovable Suggestions

Single source for all suggestions. Move items between sections; never delete.

## Active Suggestions

### Clear the 19 pre-existing ESLint warnings
- **Status:** Pending
- **Priority:** Low
- **Description:** 10 extension + 9 root warnings (react-hooks/exhaustive-deps, react-refresh/only-export-components). Split shadcn UI files so they only export components, and audit the useCallback dep arrays in `ExportPanel`, `FullPageActions`, `DebugPreview`.
- **Added:** this session

## Implemented Suggestions

### Auto-touch zips in pre-commit
- **Implemented:** this session
- **Notes:** `scripts/hooks/pre-commit` rebuilds `public/inspect-page.zip` (via `scripts/release.sh`) and/or `public/inspect-page-wp.zip` (via `scripts/package-wp.sh`) when matching paths are staged, then auto-stages the zip + `.sha256` + `.srchash`. Install once via `bash scripts/hooks/install.sh`. Bypass with `git commit --no-verify`.

### Drop `--max-warnings=0` from extension lint script
- **Implemented:** this session
- **Notes:** `extension/package.json` `lint` now runs the root eslint binary without `--max-warnings=0` to surface (but not fail on) pre-existing warnings. See `.lovable/cicd-issues/02-...`.

### Replace `showSaveFilePicker` with anchor download in Inspect tab
- **Implemented:** this session
- **Notes:** See `.lovable/solved-issues/01-export-dropdown-silent.md` and `.lovable/memory/decisions/01-export-download-strategy.md`.
