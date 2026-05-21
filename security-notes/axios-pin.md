# axios pin — minimum 1.7.4

## CVE
- **CVE-2024-39338** — SSRF via path-relative URLs (axios < 1.7.4).

## Status
- Inspect Page does **not** currently depend on `axios`. The marketing site uses
  `@tanstack/react-query` + `fetch`; the extension uses raw `fetch`; the WP
  plugin uses WordPress HTTP API.
- If any future dependency pulls `axios` in transitively, it must be >= **1.7.4**.

## Enforcement
- `scripts/ci/check-axios-version.mjs` runs in `.github/workflows/ci.yml`
  (`validate` job) and exits non-zero on any axios spec below 1.7.4.
- Guard is a no-op when axios is absent.

## If a version below 1.7.4 is required
1. Pin via `package.json` `overrides` to `^1.7.4`.
2. Run `bun install` and verify `bun pm ls axios` shows >= 1.7.4 everywhere.
3. Re-run `node scripts/ci/check-axios-version.mjs` locally before pushing.