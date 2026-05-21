# 04 — `check-zip-freshness` flaky on CI (mtime-based)

## Symptom
CI repeatedly failed with `public/inspect-page-wp.zip stale by 0.00h vs wp-plugin` even right after `bash scripts/package-wp.sh`. Local runs passed; CI runs failed.

## Root cause
`git checkout` does NOT preserve file mtimes — each checked-out file gets the checkout time in arbitrary order. So on CI a source file under `wp-plugin/` could end up with an mtime microseconds newer than the zip's mtime, tripping the comparison even when content is identical.

## Fix (permanent)
Switched freshness check from **mtime** to **content hash**:

1. New helper `scripts/ci/_srchash.mjs` — deterministic SHA-256 over sorted `relpath\0filehash\n` of every source file (skips `node_modules`, `.git`, `tests`, `.DS_Store`, `*.log`).
2. `scripts/package-wp.sh` writes `public/inspect-page-wp.zip.srchash` after zipping.
3. `extension/scripts/package.sh` writes `public/inspect-page.zip.srchash` after zipping.
4. `scripts/ci/check-zip-freshness.mjs` recomputes the hash of `extension-src/` and `wp-plugin/inspect-page/` and compares to the stored `.srchash`. Mismatch → stale.

## Prevention
- Never reintroduce mtime comparisons for CI freshness gates.
- Any change under `wp-plugin/inspect-page/` or `extension-src/` requires repackaging (`bash scripts/package-wp.sh` or `bash extension/scripts/package.sh`) so the `.srchash` updates.
- If you add a new shipped zip, follow the same pattern: write `<zip>.srchash` at package time and add a target to `check-zip-freshness.mjs`.

## Status
✅ Resolved — all 5 CI checks green.