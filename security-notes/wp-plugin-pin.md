# WordPress plugin pins

## Runtime floors
- **WordPress core:** >= 6.4 (REST cookie auth + nonce flow stable; required by
  Smart Share bridge in `wp-plugin/inspect-page/`).
- **PHP:** >= 7.4 (typed properties + null coalescing used throughout).
- **Stripe PHP SDK:** vendored copy in `wp-plugin/inspect-page/vendor/stripe/`.
  Pin = whatever ships in the zip; do not auto-update without re-running
  `scripts/smoke-rest.sh` + `bash scripts/package-wp.sh`.

## Why no automated guard yet
- WP plugin has no `composer.json` / lockfile in the shipped zip.
- Adding a guard means parsing `wp-plugin/inspect-page/vendor/composer/installed.json`
  if/when we move to Composer. Out of scope for the initial CI/CD wiring.

## If a CVE drops for any vendored WP dep
1. Update the vendored copy under `wp-plugin/inspect-page/vendor/`.
2. Bump WP plugin header `Version:` + `INSPECT_PAGE_VERSION` constant.
3. Run `node scripts/ci/check-wp-version-sync.mjs` — must pass.
4. Run `bash scripts/package-wp.sh` — regenerates `public/inspect-page-wp.zip` + `.sha256`.
5. Append release note to `docs/PROJECT-DOCS.md` section 9.