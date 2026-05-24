# Git hooks

## pre-commit

Auto-repackages the extension and/or WP plugin zips when source files under
`extension-src/` or `wp-plugin/` are staged, then re-stages the refreshed
`public/*.zip` + `.sha256` + `.srchash` so `scripts/ci/check-zip-freshness.mjs`
cannot fail in CI.

## Install

```bash
bash scripts/hooks/install.sh
```

This symlinks `.git/hooks/pre-commit` → `scripts/hooks/pre-commit`. The hook
is then versioned with the repo — every clone just needs to run the installer
once.

## Bypass

If you intentionally want to skip the rebuild (e.g. doc-only commit on top of
a stale source change), pass `--no-verify` to `git commit`.
