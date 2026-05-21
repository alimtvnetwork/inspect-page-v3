#!/usr/bin/env bash
# Pre-commit hook — runs coding-guidelines checks on staged files.
# Install: ln -s ../../linters-cicd/ci/pre-commit-hook.sh .git/hooks/pre-commit

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LINTERS_DIR="$REPO_ROOT/linters-cicd"

if [ ! -d "$LINTERS_DIR" ]; then
    echo "linters-cicd/ not found — install via:" >&2
    echo "  curl -fsSL https://github.com/alimtvnetwork/coding-guidelines-v23/releases/latest/download/install.sh | bash" >&2
    exit 0
fi

bash "$LINTERS_DIR/run-all.sh" --path "$REPO_ROOT" --format text --output /tmp/coding-guidelines.txt
rc=$?
cat /tmp/coding-guidelines.txt
if [ "$rc" -ne 0 ]; then
    echo ""
    echo "❌ Coding-guidelines checks failed. Bypass with: git commit --no-verify" >&2
fi
exit "$rc"
