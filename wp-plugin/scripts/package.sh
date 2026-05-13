#!/usr/bin/env bash
# Packages wp-plugin/inspect-page/ into ../public/inspect-page-wp.zip for the
# landing page download. Run from repo root or this directory.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SRC="$HERE/inspect-page"
OUT="$ROOT/public/inspect-page-wp.zip"

if [ ! -d "$SRC" ]; then
  echo "missing $SRC" >&2
  exit 1
fi

rm -f "$OUT"
( cd "$HERE" && zip -qr "$OUT" inspect-page \
    -x 'inspect-page/.git/*' \
    -x 'inspect-page/.DS_Store' )

sha256sum "$OUT" | awk '{print $1}' > "$OUT.sha256"
echo "wrote $OUT"