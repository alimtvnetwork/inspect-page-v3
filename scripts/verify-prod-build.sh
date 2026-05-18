#!/usr/bin/env bash
# verify-prod-build.sh — CWS-upload gate for Inspect Page.
# Fails (non-zero) if the build is not safe to upload to the Chrome Web Store.
# Checks (idempotent, read-only):
#   1. INSPECT_PAGE_WP_SITE_URL constant is non-empty and https://
#   2. public/inspect-page.zip exists and matches its .sha256
#   3. extension-src/manifest.json version matches release notes filename
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "  ok  $*"; }

echo "[verify-prod-build] Inspect Page CWS gate"

# 1. WP site URL constant
url_line="$(grep -E '^export const INSPECT_PAGE_WP_SITE_URL' extension-src/shared/constants.ts || true)"
url_val="$(printf '%s' "$url_line" | sed -E 's/.*=\s*"([^"]*)".*/\1/')"
if [ -z "$url_val" ]; then
  fail "INSPECT_PAGE_WP_SITE_URL is empty in extension-src/shared/constants.ts — set the prod WP URL before CWS upload."
fi
case "$url_val" in
  https://*) pass "WP site URL: $url_val" ;;
  *) fail "INSPECT_PAGE_WP_SITE_URL must start with https:// (got: $url_val)" ;;
esac

# 2. zip + sha256
[ -f public/inspect-page.zip ] || fail "public/inspect-page.zip missing — run extension/scripts/package.sh"
[ -f public/inspect-page.zip.sha256 ] || fail "public/inspect-page.zip.sha256 missing"
expected="$(awk '{print $1}' public/inspect-page.zip.sha256)"
actual="$(sha256sum public/inspect-page.zip | awk '{print $1}')"
[ "$expected" = "$actual" ] || fail "sha256 mismatch for public/inspect-page.zip (expected $expected, got $actual)"
pass "zip sha256 matches ($actual)"

# 3. manifest version vs release notes
ver="$(node -e 'console.log(require("./extension-src/manifest.json").version)')"
notes="docs/RELEASE-NOTES-v${ver}.md"
[ -f "$notes" ] || fail "missing $notes for manifest version $ver"
pass "release notes present: $notes"

echo "[verify-prod-build] PASS — safe to upload v${ver} to Chrome Web Store"