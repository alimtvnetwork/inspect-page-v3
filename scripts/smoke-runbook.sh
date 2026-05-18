#!/usr/bin/env bash
# Dry-run the v2.7.0 live-mode runbook against a staging WordPress.
# Read-only / non-mutating checks only — proves the env is wired correctly
# BEFORE you swap Stripe into live mode. See docs/LIVE-MODE-RUNBOOK-v2.7.0.md.
#
# Requirements: curl, jq, unzip, openssl, sha256sum.
#
# Usage:
#   SITE=https://stage.inspect-page.app \
#   USER=admin PASS='xxxx xxxx xxxx xxxx' \
#   WS_ID=1 EXPECTED_URL=https://stage.inspect-page.app \
#     bash scripts/smoke-runbook.sh
#
# Exits 0 only if all checks pass; non-zero with a per-step FAIL line otherwise.

set -uo pipefail

: "${SITE:?Set SITE=https://stage-host}"
: "${USER:?Set USER=<wp-username>}"
: "${PASS:?Set PASS=<application-password>}"
: "${WS_ID:=}"                       # optional: workspace id to probe
: "${EXPECTED_URL:=}"                # optional: WP URL expected baked into extension
: "${ZIP:=public/inspect-page.zip}"  # path to the extension zip to verify

NS="$SITE/wp-json/inspect-page/v1"
AUTH=(-u "$USER:$PASS")
PASSES=0
FAILS=0

pass() { echo "PASS · $1"; PASSES=$((PASSES + 1)); }
fail() { echo "FAIL · $1"; FAILS=$((FAILS + 1)); }

echo "==> 1. /me reachable (cookie + nonce bootstrap)"
ME=$(curl -fsS "${AUTH[@]}" "$NS/me" 2>/dev/null || true)
NONCE=$(echo "$ME" | jq -r .nonce 2>/dev/null || true)
if [ -n "$NONCE" ] && [ "$NONCE" != "null" ]; then
  pass "/me returned nonce"
else
  fail "/me did not return a nonce — check WP auth / permalinks"
fi

echo "==> 2. Permalinks = Post name (REST namespace resolves)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NS")
[ "$CODE" = "200" ] && pass "REST namespace 200" || fail "REST namespace returned $CODE"

echo "==> 3. /billing/status responds"
BS=$(curl -fsS "${AUTH[@]}" -H "X-WP-Nonce: $NONCE" \
  "$NS/billing/status${WS_ID:+?workspace_id=$WS_ID}" 2>/dev/null || true)
if echo "$BS" | jq -e .plan >/dev/null 2>&1; then
  PLAN=$(echo "$BS" | jq -r .plan)
  MODE=$(echo "$BS" | jq -r '.mode // "unknown"')
  pass "/billing/status plan=$PLAN mode=$MODE"
  if [ "$MODE" = "live" ]; then
    pass "Stripe mode is LIVE"
  else
    echo "INFO · Stripe mode is $MODE (expected for staging; flip to live in step 4 of runbook)"
  fi
  PRICE=$(echo "$BS" | jq -r '.price.unit_amount // empty')
  [ -n "$PRICE" ] && pass "Pro price resolved (unit_amount=$PRICE)" \
    || fail "Pro price NOT resolved — wrong price_id or cache stale"
else
  fail "/billing/status did not return JSON with .plan"
fi

echo "==> 4. /workspaces endpoint (Team Workspaces wired)"
WS=$(curl -fsS "${AUTH[@]}" -H "X-WP-Nonce: $NONCE" "$NS/workspaces" 2>/dev/null || true)
if echo "$WS" | jq -e 'type == "array"' >/dev/null 2>&1; then
  COUNT=$(echo "$WS" | jq 'length')
  pass "/workspaces returned $COUNT workspace(s)"
else
  fail "/workspaces did not return an array — plugin pre-2.6.0?"
fi

echo "==> 5. Recent /sessions GET (workspace-filterable)"
SCODE=$(curl -s -o /dev/null -w "%{http_code}" "${AUTH[@]}" \
  -H "X-WP-Nonce: $NONCE" \
  "$NS/sessions${WS_ID:+?workspace_id=$WS_ID}")
[ "$SCODE" = "200" ] && pass "/sessions 200" || fail "/sessions returned $SCODE"

echo "==> 6. Extension zip integrity"
if [ -f "$ZIP" ]; then
  pass "zip present ($ZIP)"
  unzip -t "$ZIP" >/dev/null 2>&1 && pass "zip CRC ok" || fail "zip CRC failed"
  if [ -f "${ZIP}.sha256" ]; then
    EXPECTED_HASH=$(awk '{print $1}' "${ZIP}.sha256")
    ACTUAL_HASH=$(sha256sum "$ZIP" | awk '{print $1}')
    [ "$EXPECTED_HASH" = "$ACTUAL_HASH" ] && pass "sha256 matches sidecar" \
      || fail "sha256 mismatch — repackage and re-hash"
  fi
  if [ -n "$EXPECTED_URL" ]; then
    if unzip -p "$ZIP" 'assets/*.js' 2>/dev/null | grep -qF "$EXPECTED_URL"; then
      pass "baked WP URL = $EXPECTED_URL"
    else
      fail "EXPECTED_URL not found in bundled JS — set INSPECT_PAGE_WP_SITE_URL and rebuild"
    fi
  fi
else
  fail "zip not found at $ZIP"
fi

echo "==> 7. Asset security headers (sniff via OPTIONS — write a session first if 0)"
# Best-effort: just check the namespace OPTIONS returns CSP-friendly defaults.
HDR=$(curl -sI "$NS" | tr -d '\r')
echo "$HDR" | grep -qi "x-content-type-options: nosniff" \
  && pass "X-Content-Type-Options: nosniff on namespace" \
  || echo "INFO · namespace itself does not set nosniff (asset routes do — re-run §9 of PEN-TEST-v2.7.0.md manually with a live session)"

echo
echo "──────── Smoke summary ────────"
echo "PASS: $PASSES   FAIL: $FAILS"
if [ "$FAILS" -gt 0 ]; then
  echo "Resolve every FAIL before proceeding to step 5 (live webhook smoke) of the runbook."
  exit 1
fi
echo "All green. Safe to proceed to step 5 of docs/LIVE-MODE-RUNBOOK-v2.7.0.md."