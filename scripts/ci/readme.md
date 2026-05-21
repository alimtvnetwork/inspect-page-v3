# scripts/ci/

Validators run in CI (`.github/workflows/ci.yml`, Phase 3) and locally before release.

| Script | Purpose | Exit non-zero when |
|---|---|---|
| `check-brand-name.mjs` | Brand guard | Any of `PagePort`, `LLM Export`, `LLM Page Export`, `llm-export` appears in `extension-src/`, `wp-plugin/`, `src/`, or `public/`. |
| `check-version-sync.mjs` | Extension version drift | `extension-src/manifest.json` disagrees with `WhatsNew.tsx` or `PROJECT-DOCS.md`. |
| `check-wp-version-sync.mjs` | WP plugin version drift | Plugin header `Version:`, `INSPECT_PAGE_VERSION` constant, and `PROJECT-DOCS.md` disagree. |
| `check-zip-freshness.mjs` | Stale shipped zips | Source mtime in `extension-src/` or `wp-plugin/` newer than the corresponding zip in `public/`. |
| `check-axios-version.mjs` | Supply-chain pin | `axios` enters deps below `1.7.4` (CVE-2024-39338). |

Run all locally:

```bash
for s in scripts/ci/check-*.mjs; do node "$s" || exit 1; done
```

See `pipeline/04-validation-scripts.md` for the design rationale.