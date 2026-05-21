# 01 — `check-zip-freshness` reports WP zip stale

## Symptom
```
[check-zip-freshness] Stale zips:
  public/inspect-page-wp.zip stale by 0.00h vs wp-plugin
  Fix: run `bash scripts/release.sh` (or package-wp.sh).
Error: Process completed with exit code 1.
```

## Root cause
`scripts/ci/check-zip-freshness.mjs` walks `wp-plugin/` for the newest mtime and compares to `public/inspect-page-wp.zip` mtime. Any edit (even formatting / mtime touch) under `wp-plugin/` invalidates the zip until repackaged.

## Fix
```bash
bash scripts/package-wp.sh
# (optional — refresh both zip mtimes if extension zip is still fresh on disk):
touch public/inspect-page-wp.zip public/inspect-page.zip
node scripts/ci/check-zip-freshness.mjs
```

## Prevention
Always run `bash scripts/release.sh` (or `package-wp.sh` / `package.sh`) **after** any change in `wp-plugin/` or `extension-src/`, before committing.

## Status
✅ Resolved — repackaged this session.
