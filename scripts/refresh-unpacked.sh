#!/usr/bin/env bash
# Rebuilds the extension and refreshes ./extension-unpacked/ in place
# so Chrome's "Load unpacked" target always points at the latest build.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/extension"
bun install >/dev/null
bun run build
rm -rf "$ROOT/extension-unpacked"
cp -r "$ROOT/extension/dist/extension" "$ROOT/extension-unpacked"
# Preserve the README
cat > "$ROOT/extension-unpacked/README.md" <<'EOF'
# Inspect Page — Load Unpacked

Already-built extension. In `chrome://extensions` enable Developer mode,
click **Load unpacked**, and pick this folder. Reload from the card after
running `bash scripts/refresh-unpacked.sh` again.
EOF
echo "extension-unpacked refreshed ($(du -sh "$ROOT/extension-unpacked" | cut -f1))"