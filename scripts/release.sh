#!/usr/bin/env bash
# One-shot release builder: rebuilds the Chrome extension, repackages both
# zips into public/, and prints their checksums.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building extension"
( cd "$ROOT/extension" && bun install --frozen-lockfile && bun run build )

echo "==> Packaging extension zip"
bash "$ROOT/extension/scripts/package.sh"

echo "==> Packaging WordPress plugin zip"
bash "$ROOT/scripts/package-wp.sh"

echo
echo "==> Release artifacts:"
( cd "$ROOT/public" && ls -lh inspect-page.zip inspect-page-wp.zip )
( cd "$ROOT/public" && cat inspect-page.zip.sha256 inspect-page-wp.zip.sha256 )