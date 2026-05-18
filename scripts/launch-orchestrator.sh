#!/usr/bin/env bash
# Resumable orchestrator for the Inspect Page v2.7.0 / v2.6.0 launch.
# Chains the existing helpers in the correct order, records a checkpoint
# after each completed step in .lovable/launch-state.json, and resumes
# from the last failing step when re-run.
#
# Steps (in order):
#   1. seed     → scripts/seed-staging.sh  (STAGING env)
#   2. smoke    → scripts/smoke-runbook.sh (STAGING env)
#   3. wpurl    → assert INSPECT_PAGE_WP_SITE_URL is set to $PROD_WP
#   4. build    → cd extension && bun install && bun run build && scripts/package.sh
#   5. verify   → scripts/verify-prod-build.sh
#   6. stripe   → MANUAL pause: wire Stripe live keys/price/webhook in WP admin
#   7. capture  → scripts/capture-cws-screenshots.sh
#   8. pentest  → MANUAL pause: walk docs/PEN-TEST-v2.7.0.md (9 tests)
#   9. ac       → MANUAL pause: walk PHASE-6 AC matrix
#  10. cws      → MANUAL pause: upload public/inspect-page.zip to CWS
#  11. tag      → git tag ext-v2.7.0 + wp-v2.6.0 (only after CWS publishes)
#
# Usage:
#   PROD_WP=https://app.inspectpage.com \
#   STAGING=https://demo.inspect-page.app \
#   WP_USER=admin WP_PASS='app password' \
#   WP_SSH='ssh deploy@stage -- wp --path=/var/www/html' \
#     bash scripts/launch-orchestrator.sh             # resume / run next step
#   bash scripts/launch-orchestrator.sh --status      # print checkpoint table
#   bash scripts/launch-orchestrator.sh --reset       # wipe checkpoint file
#   bash scripts/launch-orchestrator.sh --only build  # run a single step

set -uo pipefail

STATE_FILE=.lovable/launch-state.json
mkdir -p "$(dirname "$STATE_FILE")"
[ -f "$STATE_FILE" ] || echo '{}' > "$STATE_FILE"

STEPS=(seed smoke wpurl build verify stripe capture pentest ac cws tag)

mark() {
  local k="$1" v="$2"
  local tmp; tmp=$(mktemp)
  jq --arg k "$k" --arg v "$v" --arg t "$(date -u +%FT%TZ)" \
    '. + {($k): {status: $v, at: $t}}' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}
status_of() { jq -r --arg k "$1" '.[$k].status // "todo"' "$STATE_FILE"; }
at_of()     { jq -r --arg k "$1" '.[$k].at     // "-"'    "$STATE_FILE"; }

print_status() {
  printf "%-10s %-8s %s\n" STEP STATUS WHEN
  for s in "${STEPS[@]}"; do
    printf "%-10s %-8s %s\n" "$s" "$(status_of "$s")" "$(at_of "$s")"
  done
}

pause() {
  echo
  echo "── MANUAL STEP: $1 ──"
  echo "$2"
  read -r -p "Type DONE once complete (anything else aborts): " ans
  [ "$ans" = "DONE" ]
}

run_step() {
  local step="$1"
  echo
  echo "════════ $step ════════"
  case "$step" in
    seed)
      : "${STAGING:?Set STAGING=https://demo.inspect-page.app}"
      SITE="$STAGING" bash scripts/seed-staging.sh ;;
    smoke)
      : "${STAGING:?}" ; : "${WP_USER:?}" ; : "${WP_PASS:?}"
      SITE="$STAGING" USER="$WP_USER" PASS="$WP_PASS" \
        EXPECTED_URL="$STAGING" bash scripts/smoke-runbook.sh ;;
    wpurl)
      : "${PROD_WP:?Set PROD_WP=https://app.inspectpage.com}"
      grep -qF "\"$PROD_WP\"" extension-src/shared/constants.ts \
        || { echo "FAIL · INSPECT_PAGE_WP_SITE_URL != $PROD_WP — edit constants.ts"; return 1; }
      echo "PASS · constant = $PROD_WP" ;;
    build)
      ( cd extension && bun install && bun run build && bash scripts/package.sh )
      sha256sum public/inspect-page.zip > public/inspect-page.zip.sha256 ;;
    verify)
      STAGING_HOST="$(echo "${STAGING:-}" | sed -E 's#^https?://##')" \
        bash scripts/verify-prod-build.sh ;;
    stripe)
      pause "Stripe live wiring" \
"In wp-admin → Settings → Inspect Page → Billing:
  - mode = live
  - sk_live_… secret key
  - whsec_… webhook secret (from Stripe dashboard, step 3 of runbook)
  - price_… (live)
Click 'Test connection' — must show 'OK · live mode · price resolved'." ;;
    capture)
      : "${STAGING:?}"
      STAGING_WP="$STAGING" bash scripts/capture-cws-screenshots.sh ;;
    pentest)
      pause "Pen-test pass" \
"Walk docs/PEN-TEST-v2.7.0.md end-to-end against staging. All 9 tests must PASS.
Any FAIL = blocker. File a 'security' issue and abort." ;;
    ac)
      pause "Acceptance matrix" \
"Walk PHASE-6 in docs/PHASE-6-LAUNCH-CHECKLIST.md against the LIVE env:
  AC-BILL-1…5, AC-ANALYTICS-1…3, AC-UI-259-1…3, AC-WS-1…7.
Record PASS/FAIL inline and commit." ;;
    cws)
      pause "Chrome Web Store upload" \
"Open https://chrome.google.com/webstore/devconsole/
  - Upload public/inspect-page.zip (v2.7.0)
  - 'What's new' from store-assets/listing-2.7.0.md
  - Replace screenshots with store-assets/screen-{1..5}.png
  - Submit for review.
Wait for CWS to mark Published before continuing to 'tag'." ;;
    tag)
      git tag ext-v2.7.0 -m "Chrome extension v2.7.0 — Team Workspaces" 2>/dev/null || echo "  · ext-v2.7.0 tag already exists"
      git tag wp-v2.6.0  -m "WP plugin v2.6.0 — Team Workspaces"        2>/dev/null || echo "  · wp-v2.6.0 tag already exists"
      echo "Now push: git push origin ext-v2.7.0 wp-v2.6.0" ;;
    *) echo "unknown step: $step"; return 1 ;;
  esac
}

case "${1:-}" in
  --status) print_status; exit 0 ;;
  --reset)  echo '{}' > "$STATE_FILE"; echo "state cleared"; exit 0 ;;
  --only)
    [ -n "${2:-}" ] || { echo "usage: --only <step>"; exit 2; }
    if run_step "$2"; then mark "$2" done; else mark "$2" failed; exit 1; fi
    print_status; exit 0 ;;
esac

for s in "${STEPS[@]}"; do
  case "$(status_of "$s")" in
    done) echo "✓ $s (done $(at_of "$s"))" ;;
    *)
      if run_step "$s"; then
        mark "$s" done
      else
        mark "$s" failed
        echo
        echo "Stopped at: $s. Fix the failure and re-run to resume."
        exit 1
      fi
      ;;
  esac
done

echo
echo "🎉 All launch steps complete."
print_status