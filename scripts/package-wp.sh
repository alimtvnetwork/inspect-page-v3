#!/usr/bin/env bash
# Package the Inspect Page WordPress plugin into a release zip.
#
# Output:
#   public/inspect-page-wp.zip
#   public/inspect-page-wp.zip.sha256
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/wp-plugin/inspect-page"
OUT="$ROOT/public/inspect-page-wp.zip"

if [ ! -f "$SRC/inspect-page.php" ]; then
  echo "wp-plugin/inspect-page/inspect-page.php not found." >&2
  exit 1
fi

VERSION="$(grep -E "^[[:space:]]*\*[[:space:]]*Version:" "$SRC/inspect-page.php" \
  | head -1 | sed -E 's/.*Version:[[:space:]]*//')"
echo "Packaging WP plugin v$VERSION"

rm -f "$OUT" "$OUT.sha256"
(
  cd "$ROOT/wp-plugin"
  nix run nixpkgs#zip -- -r "$OUT" inspect-page \
    -x "inspect-page/tests/*" \
    -x "inspect-page/**/.DS_Store" \
    -x "inspect-page/**/*.log" \
    >/dev/null
)
( cd "$ROOT/public" && sha256sum "inspect-page-wp.zip" > "inspect-page-wp.zip.sha256" )
echo "Packaged: $OUT ($(du -h "$OUT" | cut -f1))"