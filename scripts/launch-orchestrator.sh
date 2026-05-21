#!/usr/bin/env bash
# launch-orchestrator.sh — resumable 11-step driver for the v2.7.5 launch.
# Checkpoints live in .lovable/launch-state.json. Idempotent.
# Flags: --status   show current step
#        --reset    clear checkpoints
#        --only N   run only step N
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/.lovable/launch-state.json"
mkdir -p "$(dirname "$STATE")"
[ -f "$STATE" ] || echo '{"completed":[]}' > "$STATE"

STEPS=(
  "verify-prod-build:bash scripts/verify-prod-build.sh"
  "smoke-runbook:bash scripts/smoke-runbook.sh"
  "seed-staging:echo skip seed-staging unless WP_SSH set"
  "pen-tests:echo 'manual: walk docs/PEN-TEST-v2.7.0.md'"
  "acceptance-bill:echo 'manual: AC-BILL-1..5'"
  "acceptance-analytics:echo 'manual: AC-ANALYTICS-1..3'"
  "acceptance-ws:echo 'manual: AC-WS-1..7'"
  "capture-screenshots:bash scripts/capture-cws-screenshots.sh"
  "cws-upload:echo 'manual: upload public/inspect-page.zip to Chrome Web Store'"
  "git-tags:echo 'manual: tag ext-v2.7.0 and wp-v2.6.0'"
  "post-launch-watch:bash scripts/post-launch-watch.sh --once"
)

is_done() { grep -q "\"$1\"" "$STATE"; }
mark()    { node -e "const f='$STATE';const j=JSON.parse(require('fs').readFileSync(f));j.completed=[...new Set([...j.completed,'$1'])];require('fs').writeFileSync(f,JSON.stringify(j,null,2));"; }

case "${1:-}" in
  --status) cat "$STATE"; exit 0 ;;
  --reset)  echo '{"completed":[]}' > "$STATE"; echo "reset."; exit 0 ;;
  --only)   shift; ONLY="${1:-}"; ;;
  *)        ONLY="" ;;
esac

i=0
for entry in "${STEPS[@]}"; do
  i=$((i+1))
  name="${entry%%:*}"; cmd="${entry#*:}"
  [ -n "${ONLY:-}" ] && [ "$ONLY" != "$i" ] && continue
  if is_done "$name" && [ -z "${ONLY:-}" ]; then
    echo "[$i/11] $name  (done, skipping)"; continue
  fi
  echo "[$i/11] $name"
  if bash -c "$cmd"; then mark "$name"; else echo "STOP at step $i ($name)"; exit 1; fi
done
echo "[launch] all steps complete."