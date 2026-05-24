#!/usr/bin/env bash
# Install Inspect Page git hooks into .git/hooks/.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
ln -sf "../../scripts/hooks/pre-commit" "$ROOT/.git/hooks/pre-commit"
echo "Installed pre-commit hook → .git/hooks/pre-commit"
