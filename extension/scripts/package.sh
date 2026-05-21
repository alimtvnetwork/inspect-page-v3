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

if [ ! -f "$DIST/offscreen.html" ]; then
  echo "dist/extension/offscreen.html missing. Rebuild the extension before packaging." >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required to package the extension." >&2
  exit 1
fi

rm -f "$OUT" "$OUT.sha256"
( cd "$DIST" && zip -r "$OUT" . >/dev/null )
( cd "$ROOT/public" && sha256sum "inspect-page.zip" > "inspect-page.zip.sha256" )
node "$ROOT/scripts/ci/_srchash.mjs" "$ROOT/extension-src" > "$ROOT/public/inspect-page.zip.srchash"
echo "Packaged: $OUT ($(du -h "$OUT" | cut -f1))"
