#!/usr/bin/env bash
# Verify codegen determinism — Task #05.
#
# Re-runs the inverted-field codegen on the committed source fixtures
# into a temp directory and compares the output byte-for-byte against
# the committed expected/ artifacts.
#
# Exit codes:
#   0  — output matches expected/ exactly (CI green)
#   1  — drift detected; either the codegen changed unexpectedly OR
#         expected/ was not regenerated. Fix by running:
#             bash linters-cicd/codegen/scripts/regen-codegen-fixtures.sh
#         then commit the resulting expected/ files.
#
# Backed by the round-trip + determinism guarantees proven in
# linters-cicd/tests/test_codegen_inversion_table.py (Task #04).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEGEN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCES="$CODEGEN_DIR/fixtures/sources"
EXPECTED="$CODEGEN_DIR/fixtures/expected"
TOOL="$CODEGEN_DIR/inverted_fields.py"

if [[ ! -d "$EXPECTED" ]]; then
    echo "::error::Expected fixtures missing: $EXPECTED"
    echo "         Run: bash linters-cicd/codegen/scripts/regen-codegen-fixtures.sh"
    exit 1
fi

ACTUAL="$(mktemp -d -t codegen-verify-XXXXXX)"
trap 'rm -rf "$ACTUAL"' EXIT

verify_one() {
    local lang="$1"
    local ext="$2"
    local input="$SOURCES/User.$ext"
    local actual_out="$ACTUAL/User.generated.$ext"
    local expected_out="$EXPECTED/User.generated.$ext"

    python3 "$TOOL" --input "$input" --lang "$lang" --output "$actual_out" >/dev/null

    if ! python3 -c "
import sys, difflib, pathlib
a = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
b = pathlib.Path(sys.argv[2]).read_text(encoding='utf-8')
if a == b:
    sys.exit(0)
sys.stdout.writelines(difflib.unified_diff(
    a.splitlines(keepends=True), b.splitlines(keepends=True),
    fromfile=sys.argv[1], tofile=sys.argv[2]))
sys.exit(1)
" "$expected_out" "$actual_out"; then
        echo "::error::Codegen drift detected for lang=$lang"
        echo "         Expected: $expected_out"
        echo "         Actual:   $actual_out"
        echo "         Fix:      bash linters-cicd/codegen/scripts/regen-codegen-fixtures.sh && commit"
        return 1
    fi
    echo "  OK $lang ($(wc -l < "$expected_out") lines)"
}

echo "Verifying codegen determinism against committed fixtures"
fail=0
verify_one go go        || fail=1
verify_one php php      || fail=1
verify_one typescript ts || fail=1

if [[ $fail -ne 0 ]]; then
    exit 1
fi
echo "All codegen outputs match expected/ — determinism verified."
