#!/usr/bin/env bash
# rollback.sh — emergency rollback for Inspect Page v2.7.5 launch.
# Restores the previous CWS-uploaded zip and prints WP plugin downgrade steps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREV="${PREV:-2.6.2}"

echo "[rollback] Target previous extension version: $PREV"
echo "  1. In Chrome Web Store dashboard, re-upload public/inspect-page-${PREV}.zip"
echo "     (or revert to the last published package via 'Package' tab → previous version)"
echo "  2. WP plugin downgrade (SSH to host):"
echo "       cd /path/to/wp && wp plugin deactivate inspect-page"
echo "       wp plugin install <path-to-inspect-page-wp-${PREV}.zip> --force --activate"
echo "  3. Stripe webhook: keep enabled (event schema unchanged across 2.6 → 2.7)."
echo "  4. Post-incident: run scripts/post-launch-watch.sh to confirm metrics recovered."

if [ -f "$ROOT/public/inspect-page-${PREV}.zip" ]; then
  echo "[rollback] Found local archive: public/inspect-page-${PREV}.zip"
else
  echo "[rollback] WARN no local archive public/inspect-page-${PREV}.zip — fetch from CWS history."
fi