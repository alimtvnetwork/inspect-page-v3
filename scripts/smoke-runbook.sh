#!/usr/bin/env bash
# smoke-runbook.sh — minimal end-to-end smoke against the prod WP backend.
# Idempotent. Pass WP_URL or read from extension-src/shared/constants.ts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WP_URL="${WP_URL:-$(grep -E '^export const INSPECT_PAGE_WP_SITE_URL' "$ROOT/extension-src/shared/constants.ts" | sed -E 's/.*=\s*"([^"]*)".*/\1/')}"
[ -n "$WP_URL" ] || { echo "WP_URL empty — set the constant or pass WP_URL=https://..."; exit 1; }
echo "[smoke] target: $WP_URL"

probe() {
  local path="$1" expected="$2"
  local code; code="$(curl -s -o /dev/null -w '%{http_code}' "$WP_URL$path" || true)"
  printf '  %-50s -> %s (expect %s)\n' "$path" "$code" "$expected"
  [ "$code" = "$expected" ] || { echo "FAIL"; exit 1; }
}

probe "/wp-json/inspect-page/v1/me" "401"
probe "/wp-json/inspect-page/v1/billing/status" "401"
probe "/wp-json/" "200"
echo "[smoke] OK — REST namespace reachable, unauth gates intact."
exec "$ROOT/scripts/smoke-rest.sh"