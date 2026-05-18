#!/usr/bin/env bash
# First-24h post-launch monitor for Inspect Page v2.7.0 / v2.6.0.
# Implements step 10 of docs/LIVE-MODE-RUNBOOK-v2.7.0.md as a polling loop.
#
# Every INTERVAL seconds it samples 4 signals and prints a single line per
# tick. Exits non-zero (and beeps once) if any threshold trips so it can be
# wrapped in `watch` / tmux / a paging cron.
#
# Signals:
#   1. WP error log:     count of `[inspect-page]` ERROR|WARN since last tick
#                        (threshold: > $ERR_MAX per tick)
#   2. Stripe webhooks:  success rate over the last hour via Stripe API
#                        (threshold: < $WH_MIN_PCT %)
#   3. Share volume:     COUNT(*) wp_pp_sessions created in last hour
#                        (threshold: < $VOL_MIN_PER_HOUR — sanity floor)
#   4. /me reachable:    extension auth bootstrap still works
#                        (threshold: HTTP != 200)
#
# Usage:
#   SITE=https://app.inspectpage.com \
#   WP_USER=admin WP_PASS='app password' \
#   WP_SSH='ssh deploy@prod -- wp --path=/var/www/html' \
#   STRIPE_SECRET=sk_live_... \
#     bash scripts/post-launch-watch.sh
#
# Optional knobs (defaults shown):
#   INTERVAL=300 ERR_MAX=5 WH_MIN_PCT=99 VOL_MIN_PER_HOUR=1 DURATION=86400

set -uo pipefail

: "${SITE:?Set SITE=https://app.inspectpage.com}"
: "${WP_USER:?Set WP_USER=<admin>}"
: "${WP_PASS:?Set WP_PASS=<application password>}"
: "${WP_SSH:=wp}"
: "${STRIPE_SECRET:?Set STRIPE_SECRET=sk_live_...}"

INTERVAL="${INTERVAL:-300}"
ERR_MAX="${ERR_MAX:-5}"
WH_MIN_PCT="${WH_MIN_PCT:-99}"
VOL_MIN_PER_HOUR="${VOL_MIN_PER_HOUR:-1}"
DURATION="${DURATION:-86400}"

WP() { eval "$WP_SSH $*"; }

START=$(date +%s)
LAST_ERR_COUNT=0
TRIPPED=0

echo "post-launch-watch · site=$SITE · interval=${INTERVAL}s · duration=${DURATION}s"
printf "%-20s %6s %8s %8s %5s %s\n" TIMESTAMP NEW_ERR WH_PCT SHARES_1H ME NOTES

while [ $(( $(date +%s) - START )) -lt "$DURATION" ]; do
  TS=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
  notes=""

  # 1. WP error log delta — use wp log if available, else tail wp-content/debug.log
  TOTAL_ERR=$(WP "log tail --lines=2000 2>/dev/null | grep -cE '\\[inspect-page\\].*(ERROR|WARN)' || echo 0" 2>/dev/null | tr -d '[:space:]')
  TOTAL_ERR=${TOTAL_ERR:-0}
  NEW_ERR=$(( TOTAL_ERR - LAST_ERR_COUNT ))
  [ "$NEW_ERR" -lt 0 ] && NEW_ERR=0
  LAST_ERR_COUNT=$TOTAL_ERR
  if [ "$NEW_ERR" -gt "$ERR_MAX" ]; then notes+="err>${ERR_MAX} "; TRIPPED=1; fi

  # 2. Stripe webhook success rate (last hour, live mode)
  SINCE=$(( $(date +%s) - 3600 ))
  EVENTS=$(curl -sS -u "$STRIPE_SECRET:" \
    "https://api.stripe.com/v1/events?created[gte]=$SINCE&limit=100" \
    | jq '.data | length' 2>/dev/null)
  FAILED=$(curl -sS -u "$STRIPE_SECRET:" \
    "https://api.stripe.com/v1/events?created[gte]=$SINCE&limit=100" \
    | jq '[.data[] | select(.pending_webhooks > 0)] | length' 2>/dev/null)
  if [ -n "$EVENTS" ] && [ "$EVENTS" -gt 0 ]; then
    WH_PCT=$(( (EVENTS - ${FAILED:-0}) * 100 / EVENTS ))
  else
    WH_PCT=100
  fi
  if [ "$WH_PCT" -lt "$WH_MIN_PCT" ]; then notes+="wh<${WH_MIN_PCT}% "; TRIPPED=1; fi

  # 3. Share volume in the last hour
  SHARES=$(WP "db query \"SELECT COUNT(*) FROM wp_pp_sessions WHERE created_at > NOW() - INTERVAL 1 HOUR\" --skip-column-names 2>/dev/null | tr -d '[:space:]'" || echo 0)
  SHARES=${SHARES:-0}
  if [ "$SHARES" -lt "$VOL_MIN_PER_HOUR" ]; then notes+="vol<${VOL_MIN_PER_HOUR}/h "; fi

  # 4. /me reachable (auth bootstrap)
  ME=$(curl -s -o /dev/null -w "%{http_code}" -u "$WP_USER:$WP_PASS" "$SITE/wp-json/inspect-page/v1/me")
  if [ "$ME" != "200" ]; then notes+="me=$ME "; TRIPPED=1; fi

  printf "%-20s %6d %7d%% %8d %5s %s\n" "$TS" "$NEW_ERR" "$WH_PCT" "$SHARES" "$ME" "$notes"

  if [ "$TRIPPED" = "1" ]; then
    printf '\a'   # terminal bell
    echo "TRIPPED — see notes above. Consider scripts/rollback.sh if sustained."
    exit 1
  fi

  sleep "$INTERVAL"
done

echo "post-launch-watch · clean 24h. Promote v2.7.0 from 'monitored' to 'GA' in your tracker."