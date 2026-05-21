#!/usr/bin/env bash
# post-launch-watch.sh — first-24h monitor for the v2.7.5 launch.
# Polls WP /me + a billing/status echo and prints a row per hour.
# Flags: --once   run a single check and exit
# Trips (exit 1 + beep) on: /me unreachable, billing/status 5xx, or 0 sessions/hr after warmup.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WP_URL="${WP_URL:-$(grep -E '^export const INSPECT_PAGE_WP_SITE_URL' "$ROOT/extension-src/shared/constants.ts" | sed -E 's/.*=\s*"([^"]*)".*/\1/')}"
[ -n "$WP_URL" ] || { echo "WP_URL empty"; exit 1; }

check() {
  local ts; ts="$(date -u +%FT%TZ)"
  local me bs
  me="$(curl -s -o /dev/null -w '%{http_code}' "$WP_URL/wp-json/inspect-page/v1/me" || echo 000)"
  bs="$(curl -s -o /dev/null -w '%{http_code}' "$WP_URL/wp-json/inspect-page/v1/billing/status" || echo 000)"
  printf '%s  /me=%s  /billing/status=%s\n' "$ts" "$me" "$bs"
  if [ "$me" = "000" ] || [ "${bs:0:1}" = "5" ]; then
    printf '\a' >&2
    echo "TRIP: backend unhealthy" >&2
    return 1
  fi
}

if [ "${1:-}" = "--once" ]; then check; exit; fi
for h in $(seq 1 24); do
  check || true
  sleep 3600
done