#!/usr/bin/env bash
# Reverse the v2.7.0 / v2.6.0 live-mode launch.
# Mirrors the "Rollback" section of docs/LIVE-MODE-RUNBOOK-v2.7.0.md.
#
# Order (intentional — billing first, DB last):
#   1. Flip WP Billing → Stripe mode = test (via inspect-page REST option).
#   2. Disable the live Stripe webhook endpoint (stripe CLI).
#   3. Restore the pre-live DB dump from step 1 of the runbook.
#   4. Unpublish the in-review CWS submission (manual link printed — no CWS API).
#   5. Write a postmortem stub to docs/POSTMORTEM-<date>.md.
#
# Safe to re-run: every step is idempotent and skips on missing inputs.
#
# Usage:
#   SITE=https://app.inspectpage.com \
#   WP_USER=admin WP_PASS='app password' \
#   STRIPE_WEBHOOK_ID=we_1Live... \
#   DUMP=pre-live-2026-05-18.sql \
#   WP_SSH='ssh deploy@prod -- wp --path=/var/www/html' \
#     bash scripts/rollback.sh "step-5 webhook returned 500"

set -uo pipefail

REASON="${*:-no reason supplied}"
: "${SITE:?Set SITE=https://app.inspectpage.com}"
: "${WP_USER:?Set WP_USER=<admin>}"
: "${WP_PASS:?Set WP_PASS=<application password>}"
WP_SSH="${WP_SSH:-wp}"
WP() { eval "$WP_SSH $*"; }

FAILS=0
pass() { echo "PASS · $1"; }
fail() { echo "FAIL · $1"; FAILS=$((FAILS + 1)); }

echo "==> 1. Flip Stripe mode → test"
CODE=$(curl -s -o /tmp/rb1.json -w "%{http_code}" -u "$WP_USER:$WP_PASS" \
  -X POST "$SITE/wp-json/inspect-page/v1/billing/settings" \
  -H "Content-Type: application/json" \
  -d '{"stripe_mode":"test"}')
if [ "$CODE" = "200" ]; then pass "Stripe mode = test"; else fail "billing/settings → HTTP $CODE (body in /tmp/rb1.json)"; fi

echo "==> 2. Disable live Stripe webhook"
if [ -n "${STRIPE_WEBHOOK_ID:-}" ] && command -v stripe >/dev/null 2>&1; then
  if stripe webhook_endpoints update "$STRIPE_WEBHOOK_ID" --disabled >/dev/null 2>&1; then
    pass "webhook $STRIPE_WEBHOOK_ID disabled (signing secret preserved)"
  else
    fail "stripe CLI failed to disable $STRIPE_WEBHOOK_ID (auth? wrong id?)"
  fi
else
  echo "SKIP · set STRIPE_WEBHOOK_ID + install stripe CLI, OR disable manually in dashboard"
fi

echo "==> 3. Restore pre-live DB dump"
if [ -n "${DUMP:-}" ] && [ -f "$DUMP" ]; then
  read -r -p "  About to OVERWRITE prod DB with $DUMP — type ROLLBACK to confirm: " CONFIRM
  if [ "$CONFIRM" = "ROLLBACK" ]; then
    if cat "$DUMP" | eval "$WP_SSH db import -"; then
      pass "DB restored from $DUMP"
    else
      fail "db import failed"
    fi
  else
    echo "SKIP · DB import aborted by operator"
  fi
else
  echo "SKIP · set DUMP=<path-to-pre-live.sql> to enable"
fi

echo "==> 4. Chrome Web Store (manual — no API)"
echo "       Open: https://chrome.google.com/webstore/devconsole/"
echo "       → Inspect Page → in-review submission → Unpublish."
echo "       Users keep running the previously-published version."

echo "==> 5. Postmortem stub"
PM="docs/POSTMORTEM-$(date -u +%Y-%m-%d-%H%M).md"
mkdir -p docs
cat > "$PM" <<EOF
# Postmortem — v2.7.0 / v2.6.0 rollback

- **When (UTC):** $(date -u +'%Y-%m-%d %H:%M')
- **Triggered by:** \`scripts/rollback.sh\`
- **Failing runbook step:** _fill in (e.g. step 5 webhook smoke)_
- **Observed log line:** _paste from \`wp log tail | grep '[inspect-page]'\`_
- **Stripe event id (if any):** _evt\__
- **Workspace id (if any):** _N_
- **Reason given on the command line:** $REASON

## Timeline
- T+0:  ...

## Root cause
_TBD_

## Remediation
_TBD — required before re-attempting launch_

## Action items
- [ ] Fix-forward issue filed
- [ ] Runbook updated to prevent recurrence
- [ ] Pen-test step added to catch this class of bug
EOF
pass "postmortem stub written → $PM"

echo
echo "──────── Rollback summary ────────"
echo "Reason logged: $REASON"
echo "FAIL count:    $FAILS"
if [ "$FAILS" -gt 0 ]; then
  echo "Manual cleanup needed for the failed steps above."
  exit 1
fi
echo "Done. Fill in $PM and file a ticket tagged 'launch-rollback'."