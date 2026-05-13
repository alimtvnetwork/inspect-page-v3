#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DIST="$HERE/dist/extension"
OUT="$ROOT/public/inspect-page.zip"

if [ ! -d "$DIST" ]; then
  echo "dist/extension not found. Run 'bun run build' first." >&2
  exit 1
fi

# Ensure icons are in the bundle (vite-plugin-web-extension does not always copy them).
ICONS_SRC="$ROOT/extension-src/icons"
if [ -d "$ICONS_SRC" ]; then
  mkdir -p "$DIST/icons"
  cp -f "$ICONS_SRC"/*.png "$DIST/icons/"
fi

rm -f "$OUT" "$OUT.sha256"
( cd "$DIST" && nix run nixpkgs#zip -- -r "$OUT" . >/dev/null )
( cd "$ROOT/public" && sha256sum "inspect-page.zip" > "inspect-page.zip.sha256" )
echo "Packaged: $OUT ($(du -h "$OUT" | cut -f1))"
