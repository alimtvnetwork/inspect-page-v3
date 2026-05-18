#!/usr/bin/env bash
# Guard rail: assert the v2.7.0 extension bundle was built for production
# before it gets uploaded to the Chrome Web Store.
#
# Checks:
#   1. INSPECT_PAGE_WP_SITE_URL in extension-src/shared/constants.ts is
#      non-empty, https, no trailing slash, and not the staging host.
#   2. The exact URL is grep-able inside public/inspect-page.zip JS chunks
#      (proves the build was re-run after editing the constant).
#   3. public/inspect-page.zip.sha256 matches the on-disk sha256.
#   4. No banned brand strings ("PagePort", "LLM Export", "llm-export",
#      "pageport") in the bundled JS.
#   5. manifest.json version matches the latest CHANGELOG / release notes
#      heading (best-effort warn, not fail).
#
# Usage:
#   bash scripts/verify-prod-build.sh
#   STAGING_HOST=stage.inspect-page.app bash scripts/verify-prod-build.sh
#
# Exits 0 only if 1–4 pass.

set -uo pipefail

CONST=extension-src/shared/constants.ts
ZIP=public/inspect-page.zip
SHA=public/inspect-page.zip.sha256
STAGING_HOST="${STAGING_HOST:-stage.inspect-page.app}"
PASSES=0
FAILS=0
pass() { echo "PASS · $1"; PASSES=$((PASSES + 1)); }
fail() { echo "FAIL · $1"; FAILS=$((FAILS + 1)); }
warn() { echo "WARN · $1"; }

echo "==> 1. INSPECT_PAGE_WP_SITE_URL constant"
URL=$(grep -E 'export const INSPECT_PAGE_WP_SITE_URL' "$CONST" \
  | sed -E 's/.*"([^"]*)".*/\1/')
if [ -z "$URL" ]; then
  fail "constant is empty — set it in $CONST"
elif [[ "$URL" != https://* ]]; then
  fail "constant must start with https:// (got: $URL)"
elif [[ "$URL" == */ ]]; then
  fail "constant must NOT have a trailing slash (got: $URL)"
elif [[ "$URL" == *"$STAGING_HOST"* ]]; then
  fail "constant still points to staging host $STAGING_HOST (got: $URL)"
else
  pass "constant = $URL"
fi

echo "==> 2. URL is baked into the zip"
if [ ! -f "$ZIP" ]; then
  fail "$ZIP missing — run extension/scripts/package.sh"
elif [ -z "$URL" ]; then
  fail "skipped — constant empty"
elif unzip -p "$ZIP" 'assets/*.js' 2>/dev/null | grep -qF "$URL"; then
  pass "$URL found inside bundled JS"
else
  fail "URL NOT found in bundled JS — rebuild + repackage after editing constant"
fi

echo "==> 3. sha256 sidecar matches"
if [ -f "$ZIP" ] && [ -f "$SHA" ]; then
  EXPECTED=$(awk '{print $1}' "$SHA")
  ACTUAL=$(sha256sum "$ZIP" | awk '{print $1}')
  [ "$EXPECTED" = "$ACTUAL" ] && pass "sha256 = $ACTUAL" \
    || fail "sha256 mismatch — re-run: sha256sum $ZIP > $SHA"
else
  fail "$ZIP or $SHA missing"
fi

echo "==> 4. Banned brand strings in bundled JS"
if [ -f "$ZIP" ]; then
  HITS=$(unzip -p "$ZIP" 'assets/*.js' 2>/dev/null \
    | grep -iEo 'pageport|llm[ -]?export|llm page export' | sort -u || true)
  if [ -z "$HITS" ]; then
    pass "no banned strings in bundled JS"
  else
    fail "banned strings found: $(echo "$HITS" | tr '\n' ' ')"
  fi
fi

echo "==> 5. Version sanity (warn only)"
MV=$(unzip -p "$ZIP" manifest.json 2>/dev/null | grep -oE '"version"[^,]*' | head -1 | sed -E 's/.*"([0-9.]+)".*/\1/')
if [ -n "$MV" ]; then
  echo "INFO · manifest version = $MV"
  if ls docs/RELEASE-NOTES-v${MV}.md >/dev/null 2>&1; then
    pass "release notes exist for v$MV"
  else
    warn "no docs/RELEASE-NOTES-v${MV}.md — write one before tagging"
  fi
fi

echo
echo "──────── Verify summary ────────"
echo "PASS: $PASSES   FAIL: $FAILS"
if [ "$FAILS" -gt 0 ]; then
  echo "Resolve every FAIL before uploading to the Chrome Web Store."
  exit 1
fi
echo "Bundle ready for CWS upload."