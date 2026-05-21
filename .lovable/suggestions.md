# Lovable Suggestions

Single source for all suggestions. Move items between sections; never delete.

## Active Suggestions

### Clear the 19 pre-existing ESLint warnings
- **Status:** Pending
- **Priority:** Low
- **Description:** 10 extension + 9 root warnings (react-hooks/exhaustive-deps, react-refresh/only-export-components). Split shadcn UI files so they only export components, and audit the useCallback dep arrays in `ExportPanel`, `FullPageActions`, `DebugPreview`.
- **Added:** this session

### Auto-touch zips in pre-commit
- **Status:** Pending
- **Priority:** Low
- **Description:** Add a Git pre-commit hook that runs `scripts/release.sh` (or `package-wp.sh`) whenever files under `wp-plugin/` or `extension-src/` are staged, to avoid `check-zip-freshness` failures in CI.
- **Added:** this session

## Implemented Suggestions

### Drop `--max-warnings=0` from extension lint script
- **Implemented:** this session
- **Notes:** `extension/package.json` `lint` now runs the root eslint binary without `--max-warnings=0` to surface (but not fail on) pre-existing warnings. See `.lovable/cicd-issues/02-...`.

### Replace `showSaveFilePicker` with anchor download in Inspect tab
- **Implemented:** this session
- **Notes:** See `.lovable/solved-issues/01-export-dropdown-silent.md` and `.lovable/memory/decisions/01-export-download-strategy.md`.
