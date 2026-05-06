#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DIST="$HERE/dist/extension"
OUT="$ROOT/public/llm-export.zip"

if [ ! -d "$DIST" ]; then
  echo "dist/extension not found. Run 'bun run build' first." >&2
  exit 1
fi

rm -f "$OUT" "$OUT.sha256"
( cd "$DIST" && nix run nixpkgs#zip -- -r "$OUT" . >/dev/null )
( cd "$ROOT/public" && sha256sum "llm-export.zip" > "llm-export.zip.sha256" )
echo "Packaged: $OUT ($(du -h "$OUT" | cut -f1))"
