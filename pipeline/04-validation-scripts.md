# 04 — Validation Scripts

All validators live in `scripts/ci/` and are pure Node 20 (no
dependencies beyond the standard library). Each script exits with code
`1` on failure and prints a human-readable diagnosis. The `verify` job
in CI (and `setup` in release) runs them in this order.

## `check-brand-name.mjs`

- **Purpose**: enforce the brand-name rule recorded in project memory
  (Inspect Page — two words, capital I + P).
- **Fails on**: any occurrence of `PagePort`, `LLM Export`,
  `LLM Page Export`, or `llm-export` (case-sensitive for the first three,
  case-insensitive for `llm-export` because it covers file/folder names).
- **Scans**: `extension-src/`, `wp-plugin/`, `src/`, `docs/`, `pipeline/`,
  `scripts/`, root-level markdown. Skips `node_modules/`, `dist/`,
  `extension/dist/`, `public/*.zip`, and `bun.lock`.
- **Recommended override**: none. The rule is absolute.

## `check-version-sync.mjs` (extension)

- **Purpose**: assert that every file carrying the Chrome extension
  version agrees.
- **Files checked**:
  1. `extension/package.json` → `version`
  2. `extension-src/manifest.json` → `version` and `version_name` (when present)
  3. `docs/PROJECT-DOCS.md` → top-of-file `Current shipped: Extension vX.Y.Z` banner
  4. `src/components/landing/WhatsNew.tsx` → most-recent entry's `version`
- **CLI**: `--expect X.Y.Z` (optional) — if passed, also assert all four
  match that exact value. Release workflow always passes `--expect`.

## `check-wp-version-sync.mjs`

- **Purpose**: assert that every file carrying the WP plugin version
  agrees.
- **Files checked**:
  1. `wp-plugin/inspect-page/inspect-page.php` → `Version:` header
  2. `wp-plugin/inspect-page/inspect-page.php` → `INSPECT_PAGE_VERSION` constant
  3. `wp-plugin/inspect-page/readme.txt` → `Stable tag:`
  4. `docs/PROJECT-DOCS.md` → `Current shipped: … + WP plugin vX.Y.Z`
- **CLI**: `--expect X.Y.Z` (optional).
- **Known drift to clean up**: header currently `2.5.5`, memory records
  shipped as `2.6.0`. The next WP release commit must reconcile both.

## `check-zip-freshness.mjs`

- **Purpose**: assert that `public/*.zip.sha256` is the exact SHA-256 of
  its sibling `public/*.zip`.
- **Files checked**:
  - `public/inspect-page.zip` ↔ `public/inspect-page.zip.sha256`
  - `public/inspect-page-wp.zip` ↔ `public/inspect-page-wp.zip.sha256`
- **On failure**: prints the expected vs actual digest and instructs the
  caller to rerun `bash scripts/release.sh` or `sha256sum > .sha256`.

## `check-axios-version.mjs`

- **Purpose**: supply-chain pin enforcement. Even though Inspect Page
  does not currently ship `axios`, the validator is installed
  defensively — the moment a dependency pulls it in, the rules are
  active.
- **Banned versions**: `1.14.1`, `0.30.4` (see
  [`security-notes/axios-pin.md`](../security-notes/axios-pin.md)).
- **Required**: exact pin (no `^` / `~`) when present.
- **Scans**: every `package.json` in the repo plus `bun.lock` /
  `package-lock.json` resolved versions.

## Adding a new validator

See [`07-extending.md`](07-extending.md#adding-a-validator).