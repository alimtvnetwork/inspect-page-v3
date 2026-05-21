#!/usr/bin/env bash
# Regenerate the committed expected/ artifacts from the sources/ fixtures.
#
# Use this WHENEVER you intentionally change:
#   - the inversion table (linters-cicd/codegen/inversion_table.py)
#   - any emitter (linters-cicd/codegen/emitters/*.py)
#   - any source fixture (linters-cicd/codegen/fixtures/sources/*)
#
# CI runs the sibling verify-codegen-determinism.sh — if expected/ drifts
# from a fresh regen, the build fails. Run this script and commit the
# resulting expected/ files to fix.
#
# Spec: Task #05, plan v4.15.0
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEGEN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCES="$CODEGEN_DIR/fixtures/sources"
EXPECTED="$CODEGEN_DIR/fixtures/expected"
TOOL="$CODEGEN_DIR/inverted_fields.py"

mkdir -p "$EXPECTED"

regenerate_one() {
    local lang="$1"
    local ext="$2"
    local input="$SOURCES/User.$ext"
    local output="$EXPECTED/User.generated.$ext"

    if [[ ! -f "$input" ]]; then
        echo "::error::Missing source fixture: $input" >&2
        return 1
    fi

    python3 "$TOOL" --input "$input" --lang "$lang" --output "$output"
    echo "  regenerated $output"
}

echo "Regenerating codegen fixtures from $SOURCES"
regenerate_one go go
regenerate_one php php
regenerate_one typescript ts
echo "Done. Review the diff and commit if intentional."
