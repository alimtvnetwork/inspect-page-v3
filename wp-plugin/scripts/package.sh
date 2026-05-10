#!/usr/bin/env bash
# Packages wp-plugin/pageport/ into ../public/pageport-wp.zip for the
# landing page download. Run from repo root or this directory.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SRC="$HERE/pageport"
OUT="$ROOT/public/pageport-wp.zip"

if [ ! -d "$SRC" ]; then
  echo "missing $SRC" >&2
  exit 1
fi

rm -f "$OUT"
( cd "$HERE" && zip -qr "$OUT" pageport \
    -x 'pageport/.git/*' \
    -x 'pageport/.DS_Store' )

sha256sum "$OUT" | awk '{print $1}' > "$OUT.sha256"
echo "wrote $OUT"