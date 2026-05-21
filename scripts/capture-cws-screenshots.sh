#!/usr/bin/env bash
# capture-cws-screenshots.sh — reminder + folder scaffold for CWS screenshots.
# Real capture is manual (1280x800 Chrome profile, see store/screenshots.md).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/store-assets/screenshots-v2.7.5"
mkdir -p "$OUT"
cat <<EOF
[cws-screenshots] Output dir: $OUT

Shoot list (1280x800 PNG each):
  1-hero.png            Popup over a real page, dark-mint theme
  2-export-modes.png    Four-tab picker (MD / MD+files / ZIP / Smart Share)
  3-pick-element.png    Picker overlay highlighting a card
  4-smart-share.png     Smart Share dialog with 4 URLs + countdown
  5-workspaces.png      WP admin Workspaces page (members + invites)

Recipe: see store/screenshots.md. Disable HiDPI for the run.
Memory rule: popup theme is dark-mint (NOT white/blue) post-v2.7.0.
EOF