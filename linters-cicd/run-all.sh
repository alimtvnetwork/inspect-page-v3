#!/usr/bin/env bash
# ============================================================
# linters-cicd/run-all.sh
#
# Orchestrator — runs every check listed in checks/registry.json
# and merges results into a single SARIF 2.1.0 file. Supports
# inline suppressions, baseline diff, rule/language filters,
# parallel execution, and per-check timeouts.
#
# Usage:
#   ./run-all.sh [--path DIR] [--languages go,typescript]
#                [--rules CODE-RED-001,CODE-RED-004]
#                [--exclude-rules STYLE-002]
#                [--baseline .codeguidelines-baseline.sarif]
#                [--refresh-baseline .codeguidelines-baseline.sarif]
#                [--config .codeguidelines.toml]
#                [--jobs N|auto]            (default: 1, sequential)
#                [--check-timeout SECONDS]  (default: 20)
#                [--total-timeout SECONDS]  (default: 0 = unlimited)
#                [--split-by severity]      (also write per-severity SARIF)
#                [--strict]                 (fail on unknown TOML keys)
#                [--debug-timeout]          (log watchdog outcome: armed/canceled/fired)
#                [--output coding-guidelines.sarif] [--format sarif|text]
#                [--smoke]                  (run only rules whose check folder
#                                            changed vs HEAD, against their own
#                                            fixtures/ — see --smoke-base /
#                                            --include-template)
#                [--smoke-base REF]         (git ref for --smoke diff; default HEAD)
#                [--include-template]       (smoke-mode: also run TEMPLATE-001
#                                            against checks/_template/fixtures)
#
# Exit codes:
#   0  no findings (or refresh-baseline mode)
#   1  one or more checks emitted findings
#   2  tool error (including check timeouts)
#
# Examples:
#   # Fast run with watchdog tracing — expect "watchdog: canceled"
#   ./run-all.sh --path . --total-timeout 60 --debug-timeout
#
#   # Forced timeout — expect "watchdog: fired" plus a timeout error
#   ./run-all.sh --path . --total-timeout 1 --debug-timeout
#
#   # Combine with strict config + per-severity SARIF split
#   ./run-all.sh --path . --strict --total-timeout 60 \
#                --split-by severity --debug-timeout
# ============================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PATH_ARG="."
LANGUAGES=""
RULES=""
EXCLUDE_RULES=""
EXCLUDE_PATHS=""
BASELINE=""
REFRESH_BASELINE=""
CONFIG_FILE=".codeguidelines.toml"
OUTPUT="coding-guidelines.sarif"
FORMAT="sarif"
JOBS="${LINTERS_JOBS:-1}"
CHECK_TIMEOUT="20"
TOTAL_TIMEOUT="0"
SPLIT_BY=""
STRICT_FLAG=""
DEBUG_TIMEOUT="0"
SMOKE="0"
SMOKE_BASE="HEAD"
INCLUDE_TEMPLATE="0"

while [ $# -gt 0 ]; do
    case "$1" in
        --path)              PATH_ARG="$2"; shift 2 ;;
        --languages)         LANGUAGES="$2"; shift 2 ;;
        --rules)             RULES="$2"; shift 2 ;;
        --exclude-rules)     EXCLUDE_RULES="$2"; shift 2 ;;
        --exclude-paths)     EXCLUDE_PATHS="$2"; shift 2 ;;
        --baseline)          BASELINE="$2"; shift 2 ;;
        --refresh-baseline)  REFRESH_BASELINE="$2"; shift 2 ;;
        --config)            CONFIG_FILE="$2"; shift 2 ;;
        --jobs)              JOBS="$2"; shift 2 ;;
        --check-timeout)     CHECK_TIMEOUT="$2"; shift 2 ;;
        --total-timeout)     TOTAL_TIMEOUT="$2"; shift 2 ;;
        --split-by)          SPLIT_BY="$2"; shift 2 ;;
        --strict)            STRICT_FLAG="--strict"; shift 1 ;;
        --debug-timeout)     DEBUG_TIMEOUT="1"; shift 1 ;;
        --output)            OUTPUT="$2"; shift 2 ;;
        --format)            FORMAT="$2"; shift 2 ;;
        --smoke)             SMOKE="1"; shift 1 ;;
        --smoke-base)        SMOKE_BASE="$2"; shift 2 ;;
        --include-template)  INCLUDE_TEMPLATE="1"; shift 1 ;;
        -h|--help)
            sed -n '2,42p' "$0"; exit 0 ;;
        *)
            echo "Unknown arg: $1" >&2; exit 2 ;;
    esac
done

if ! command -v python3 >/dev/null 2>&1; then
    echo "::error::python3 is required (>= 3.10)" >&2
    exit 2
fi

REGISTRY="$SCRIPT_DIR/checks/registry.json"
if [ ! -f "$REGISTRY" ]; then
    echo "::error::registry not found at $REGISTRY" >&2
    exit 2
fi

# ---- --smoke: derive rule + fixture set, then re-invoke ourselves ----
# Smoke mode is a one-shot convenience for verifying a single rule
# you just edited. It scans only the changed/template rules against
# their own fixtures/ folders — no spec/, no src/, no full pack.
# Exit codes mirror the orchestrator (0 clean, 1 findings, 2 tool error).
if [ "$SMOKE" = "1" ]; then
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    SMOKE_FLAGS=()
    [ "$INCLUDE_TEMPLATE" = "1" ] && SMOKE_FLAGS+=(--include-template)
    SMOKE_PAYLOAD=$(python3 "$SCRIPT_DIR/scripts/smoke-select.py" \
        --repo-root "$REPO_ROOT" \
        --registry  "$REGISTRY" \
        --base      "$SMOKE_BASE" \
        "${SMOKE_FLAGS[@]}")
    SMOKE_RC=$?
    if [ "$SMOKE_RC" -eq 3 ]; then
        echo "    🚭 smoke: nothing to verify"
        echo "       no checks/<slug>/ folder changed vs '$SMOKE_BASE',"
        echo "       and --include-template was not passed."
        echo "       Edit a check or rerun with: $0 --smoke --include-template"
        exit 0
    fi
    if [ "$SMOKE_RC" -ne 0 ]; then
        echo "::error::smoke selector failed (rc=$SMOKE_RC)" >&2
        exit "$SMOKE_RC"
    fi

    SMOKE_RULES=$(echo "$SMOKE_PAYLOAD" | python3 -c \
        'import json,sys; print(",".join(json.load(sys.stdin)["rule_ids"]))')
    SMOKE_DIRS=$(echo "$SMOKE_PAYLOAD" | python3 -c \
        'import json,sys; print(chr(10).join(json.load(sys.stdin)["fixture_dirs"]))')
    SMOKE_REASONS=$(SMOKE_PAYLOAD="$SMOKE_PAYLOAD" python3 <<'PYEOF'
import json, os
d = json.loads(os.environ["SMOKE_PAYLOAD"])
for rid in d["rule_ids"]:
    reason = d["reasons"].get(rid, "?")
    print(f"         . {rid}  -- {reason}")
PYEOF
    )
    SMOKE_SKIPPED=$(echo "$SMOKE_PAYLOAD" | python3 -c \
        'import json,sys; print(",".join(json.load(sys.stdin)["skipped_slugs"]))')
    SMOKE_INCLUDES_TEMPLATE=$(echo "$SMOKE_PAYLOAD" | python3 -c \
        'import json,sys; print("yes" if "TEMPLATE-001" in json.load(sys.stdin)["rule_ids"] else "no")')

    echo "    🚬 smoke mode — verifying recently changed rule(s) only"
    echo "       base ref:        $SMOKE_BASE"
    echo "       rules selected:  ${SMOKE_RULES:-<none>}"
    echo "$SMOKE_REASONS"
    [ -n "$SMOKE_SKIPPED" ] && \
        echo "       slugs skipped:   $SMOKE_SKIPPED  (use --include-template to opt in)"
    echo ""

    if [ -z "$SMOKE_DIRS" ]; then
        echo "    ⚠️  smoke: rules selected but no fixtures/ folders found"
        echo "       create checks/<slug>/fixtures/dirty.<ext> and clean.<ext>"
        echo "       (see linters-cicd/docs/fixture-and-diagnostics-format.md)"
        exit 0
    fi

    SMOKE_EXIT=0
    SMOKE_INDEX=0
    while IFS= read -r FDIR; do
        [ -z "$FDIR" ] && continue
        SMOKE_INDEX=$((SMOKE_INDEX + 1))
        SMOKE_OUT="${OUTPUT%.sarif}.smoke-${SMOKE_INDEX}.sarif"
        echo "    ── smoke pass $SMOKE_INDEX: $FDIR"
        # Special case: the canonical _template/ pass runs the
        # starter-kit script directly because TEMPLATE-001 is
        # intentionally NOT in registry.json (the isolation guard
        # in tests/test_template_isolation.py enforces this).
        if [ "$FDIR" = "linters-cicd/checks/_template/fixtures" ] && \
           [ "$SMOKE_INCLUDES_TEMPLATE" = "yes" ]; then
            python3 "$SCRIPT_DIR/checks/_template/php.py" \
                --path "$REPO_ROOT/$FDIR" \
                --format "$FORMAT" \
                --output "$SMOKE_OUT"
            PASS_RC=$?
            if [ "$FORMAT" = "text" ] && [ -f "$SMOKE_OUT" ]; then
                cat "$SMOKE_OUT"
                echo ""
            fi
        else
            # Recursive call with the resolved scope. Drop --smoke*
            # flags so we do not loop, and propagate user knobs.
            bash "$0" \
                --path           "$REPO_ROOT/$FDIR" \
                --rules          "$SMOKE_RULES" \
                --output         "$SMOKE_OUT" \
                --format         "$FORMAT" \
                --jobs           "$JOBS" \
                --check-timeout  "$CHECK_TIMEOUT" \
                --total-timeout  "$TOTAL_TIMEOUT" \
                --exclude-paths  "$EXCLUDE_PATHS"
            PASS_RC=$?
        fi
        if [ "$PASS_RC" -eq 2 ]; then
            SMOKE_EXIT=2
        elif [ "$PASS_RC" -eq 1 ] && [ "$SMOKE_EXIT" -ne 2 ]; then
            SMOKE_EXIT=1
        fi
        echo ""
    done <<< "$SMOKE_DIRS"

    echo "    ────────────────────────────────────────────────"
    echo "    🏁 smoke complete — exit $SMOKE_EXIT"
    exit "$SMOKE_EXIT"
fi

# ---- Resolve --jobs auto → max(1, nproc - 1) ----
if [ "$JOBS" = "auto" ]; then
    if command -v nproc >/dev/null 2>&1; then
        N=$(nproc)
        JOBS=$(( N > 1 ? N - 1 : 1 ))
    else
        JOBS=1
    fi
fi
case "$JOBS" in
    ''|*[!0-9]*) echo "::error::--jobs must be an integer or 'auto', got '$JOBS'" >&2; exit 2 ;;
esac
[ "$JOBS" -lt 1 ] && JOBS=1

# ---- Validate --total-timeout and --split-by ----
case "$TOTAL_TIMEOUT" in
    ''|*[!0-9]*) echo "::error::--total-timeout must be a non-negative integer, got '$TOTAL_TIMEOUT'" >&2; exit 2 ;;
esac
if [ -n "$SPLIT_BY" ] && [ "$SPLIT_BY" != "severity" ]; then
    echo "::error::--split-by only supports 'severity', got '$SPLIT_BY'" >&2
    exit 2
fi

# ---- Detect timeout binary (BSD/macOS may lack it) ----
TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then
    TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
    TIMEOUT_BIN="gtimeout"
fi

# ---- Merge .codeguidelines.toml defaults with CLI flags ----
CONFIG_PATH="$PATH_ARG/$CONFIG_FILE"
CONFIG_OUT=$(python3 "$SCRIPT_DIR/scripts/load-config.py" \
    --config "$CONFIG_PATH" \
    --languages "$LANGUAGES" \
    --rules "$RULES" \
    --exclude-rules "$EXCLUDE_RULES" \
    --exclude-paths "$EXCLUDE_PATHS" $STRICT_FLAG)
CONFIG_RC=$?
if [ "$CONFIG_RC" -ne 0 ]; then
    echo "::error::config load failed (rc=$CONFIG_RC)" >&2
    exit "$CONFIG_RC"
fi
eval "$CONFIG_OUT"

# ---- Temp workspace ----
TMP_DIR="$(mktemp -d)"
STATUS_DIR="$TMP_DIR/_status"
mkdir -p "$STATUS_DIR"
WATCHDOG_PID=""
# Watchdog lifecycle status: not-started | armed | canceled | fired
WATCHDOG_STATUS_FILE="$TMP_DIR/_watchdog.status"
echo "not-started" > "$WATCHDOG_STATUS_FILE"

cleanup() {
    # Stop the watchdog first so it can't print a stale "exceeded" line
    # after a fast/early completion. Suppress all signal noise.
    if [ -n "$WATCHDOG_PID" ]; then
        # If watchdog hasn't already recorded "fired", mark as canceled.
        if [ -f "$WATCHDOG_STATUS_FILE" ]; then
            current=$(cat "$WATCHDOG_STATUS_FILE" 2>/dev/null || echo "")
            if [ "$current" != "fired" ]; then
                echo "canceled" > "$WATCHDOG_STATUS_FILE"
            fi
        fi
        kill -TERM "$WATCHDOG_PID" 2>/dev/null || true
        # Reap silently so bash doesn't print "Terminated".
        wait "$WATCHDOG_PID" 2>/dev/null || true
    fi
    if [ "$DEBUG_TIMEOUT" = "1" ]; then
        final_status=$(cat "$WATCHDOG_STATUS_FILE" 2>/dev/null || echo "unknown")
        echo "    🐛 watchdog: ${final_status} (total-timeout=${TOTAL_TIMEOUT}s)" >&2
    fi
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# ---- Wall-clock total timeout (B8) ----
START_EPOCH=$(date +%s)
if [ "$TOTAL_TIMEOUT" -gt 0 ]; then
    # Background watchdog: only fires if it survives past TOTAL_TIMEOUT.
    # The EXIT trap (cleanup) kills it on early/normal completion, so the
    # "exceeded" message never prints for a fast run. The subshell uses
    # short sleep slices so SIGTERM from cleanup() takes effect promptly,
    # and exits silently (rc=0) when interrupted.
    echo "armed" > "$WATCHDOG_STATUS_FILE"
    WATCHDOG_STATUS_FILE_EXPORT="$WATCHDOG_STATUS_FILE"
    (
        trap 'exit 0' TERM INT
        remaining="$TOTAL_TIMEOUT"
        while [ "$remaining" -gt 0 ]; do
            sleep 1
            remaining=$(( remaining - 1 ))
        done
        echo "fired" > "$WATCHDOG_STATUS_FILE_EXPORT"
        echo "::error::--total-timeout (${TOTAL_TIMEOUT}s) exceeded — terminating run" >&2
        kill -TERM -$$ 2>/dev/null || true
    ) &
    WATCHDOG_PID=$!
fi

EXIT=0
RAN=0

VERSION=$(cat "$SCRIPT_DIR/VERSION")
echo "    🔍 coding-guidelines linters-cicd v$VERSION"
echo "       path:           $PATH_ARG"
echo "       output:         $OUTPUT"
echo "       format:         $FORMAT"
echo "       languages:      ${LANGUAGES:-auto}"
echo "       rules:          ${RULES:-all}"
echo "       exclude-rules:  ${EXCLUDE_RULES:-none}"
echo "       exclude-paths:  ${EXCLUDE_PATHS:-none}"
echo "       jobs:           $JOBS"
echo "       check-timeout:  ${CHECK_TIMEOUT}s"
[ -n "$BASELINE" ]         && echo "       baseline:       $BASELINE"
[ -n "$REFRESH_BASELINE" ] && echo "       refresh:        $REFRESH_BASELINE"
[ -z "$TIMEOUT_BIN" ]      && echo "       ⚠️  no 'timeout' binary — running without per-check timeout"
echo ""

# Iterate registry via python (no jq dependency)
SCRIPTS=$(python3 - "$REGISTRY" "$LANGUAGES" "$RULES" <<'PY'
import json, sys
registry_path, langs_csv, rules_csv = sys.argv[1], sys.argv[2], sys.argv[3]
wanted_langs = {l.strip() for l in langs_csv.split(",") if l.strip()}
wanted_rules = {r.strip() for r in rules_csv.split(",") if r.strip()}
with open(registry_path) as f:
    reg = json.load(f)
for rule_id, meta in reg.items():
    if wanted_rules and rule_id not in wanted_rules:
        continue
    for lang, script in meta["languages"].items():
        if wanted_langs and lang != "universal" and lang not in wanted_langs:
            continue
        print(f"{rule_id}|{lang}|{script}")
PY
)

# ---- Single check runner: writes SARIF to OUT, status code to STATUS_DIR ----
run_check() {
    local rule_id="$1" lang="$2" script_path="$3" out_path="$4" status_path="$5"
    local rc
    if [ -n "$TIMEOUT_BIN" ]; then
        "$TIMEOUT_BIN" -k 2 "$CHECK_TIMEOUT" \
            python3 "$script_path" --path "$PATH_ARG" --format sarif --output "$out_path" --exclude-paths "$EXCLUDE_PATHS"
        rc=$?
    else
        python3 "$script_path" --path "$PATH_ARG" --format sarif --output "$out_path" --exclude-paths "$EXCLUDE_PATHS"
        rc=$?
    fi
    # 124 = GNU timeout overrun, 137 = SIGKILL grace, 143 = SIGTERM grace
    if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ] || [ "$rc" -eq 143 ]; then
        python3 "$SCRIPT_DIR/scripts/emit-timeout.py" \
            "$rule_id" "$lang" "$CHECK_TIMEOUT" "$out_path" "$VERSION"
        rc=124
    fi
    echo "$rc" > "$status_path"
}
export -f run_check
export PATH_ARG SCRIPT_DIR CHECK_TIMEOUT TIMEOUT_BIN VERSION EXCLUDE_PATHS

# ---- Build the work list ----
WORK_LIST="$TMP_DIR/_worklist.txt"
> "$WORK_LIST"
while IFS='|' read -r RULE_ID LANG SCRIPT; do
    [ -z "$RULE_ID" ] && continue
    SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT"
    if [ ! -f "$SCRIPT_PATH" ]; then
        echo "    ⚠️  skipped $RULE_ID/$LANG — script missing"
        continue
    fi
    echo "$RULE_ID|$LANG|$SCRIPT_PATH" >> "$WORK_LIST"
done <<< "$SCRIPTS"

TOTAL=$(wc -l < "$WORK_LIST" | tr -d ' ')

# ---- Detect whether any supported source files exist under --path ----
# Warn (don't fail) when no files match the shipping language extensions.
# The universal file-length check still runs, so this is informational.
SUPPORTED_EXTS_MAP="go:.go typescript:.ts,.tsx php:.php sql:.sql"
# Build the list of extensions actually in scope: respect --languages
# when provided, otherwise check every shipping language.
SCOPE_EXTS=""
for pair in $SUPPORTED_EXTS_MAP; do
    lang="${pair%%:*}"
    exts="${pair##*:}"
    if [ -n "$LANGUAGES" ]; then
        case ",$LANGUAGES," in
            *",$lang,"*) ;;
            *) continue ;;
        esac
    fi
    SCOPE_EXTS="$SCOPE_EXTS,$exts"
done
SCOPE_EXTS="${SCOPE_EXTS#,}"

if [ -n "$SCOPE_EXTS" ] && [ -d "$PATH_ARG" ]; then
    FOUND_ANY=$(python3 - "$PATH_ARG" "$SCOPE_EXTS" "$EXCLUDE_PATHS" <<'PY'
import os, sys, fnmatch
root, exts_csv, excl_csv = sys.argv[1], sys.argv[2], sys.argv[3]
exts = tuple(e.strip() for e in exts_csv.split(",") if e.strip())
excludes = [p.strip() for p in excl_csv.split(",") if p.strip()]
def is_excluded(rel):
    for pat in excludes:
        if fnmatch.fnmatch(rel, pat) or rel.startswith(pat.rstrip("/*") + "/"):
            return True
    return False
for dirpath, dirnames, filenames in os.walk(root):
    # Skip VCS/dependency dirs cheaply
    dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "vendor", ".venv", "__pycache__")]
    for fn in filenames:
        if not fn.endswith(exts):
            continue
        rel = os.path.relpath(os.path.join(dirpath, fn), root)
        if is_excluded(rel):
            continue
        print("yes")
        sys.exit(0)
print("no")
PY
)
    if [ "$FOUND_ANY" = "no" ]; then
        echo "    ⚠️  no supported source files detected under '$PATH_ARG'"
        echo "       supported extensions: $(echo "$SCOPE_EXTS" | tr ',' ' ' | sed 's/  */, /g')"
        echo "       (the universal file-length check will still run on all text files)"
        echo ""
    fi
fi

# ---- Sequential vs parallel dispatch ----
if [ "$JOBS" -eq 1 ]; then
    while IFS='|' read -r RULE_ID LANG SCRIPT_PATH; do
        [ -z "$RULE_ID" ] && continue
        OUT="$TMP_DIR/$RULE_ID-$LANG.sarif"
        STATUS="$STATUS_DIR/$RULE_ID-$LANG.rc"
        RAN=$((RAN + 1))
        printf "    ▸ %-30s %-12s ... " "$RULE_ID" "$LANG"
        run_check "$RULE_ID" "$LANG" "$SCRIPT_PATH" "$OUT" "$STATUS" >/dev/null 2>&1
        rc=$(cat "$STATUS")
        case "$rc" in
            0)   echo "✅ clean" ;;
            1)   COUNT=$(python3 -c "import json; print(len(json.load(open('$OUT'))['runs'][0]['results']))")
                 echo "❌ $COUNT raw finding(s)" ;;
            124) echo "⏱  timeout (>${CHECK_TIMEOUT}s)"; EXIT=2 ;;
            *)   echo "‼️  tool error (rc=$rc)"; EXIT=2 ;;
        esac
    done < "$WORK_LIST"
else
    echo "    ▸ dispatching $TOTAL check(s) across $JOBS worker(s)..."
    # xargs -P for parallel dispatch; each line is one job
    # -P parallel workers, one bash invocation per line, line passed as $0
    xargs -P "$JOBS" -I {} bash -c '
            line="$1"
            rule_id=$(echo "$line" | cut -d"|" -f1)
            lang=$(echo "$line" | cut -d"|" -f2)
            script_path=$(echo "$line" | cut -d"|" -f3)
            out="'"$TMP_DIR"'/${rule_id}-${lang}.sarif"
            status="'"$STATUS_DIR"'/${rule_id}-${lang}.rc"
            run_check "$rule_id" "$lang" "$script_path" "$out" "$status" >/dev/null 2>&1
        ' _ {} < "$WORK_LIST"
    # Render results in registry order for stable logs
    while IFS='|' read -r RULE_ID LANG SCRIPT_PATH; do
        [ -z "$RULE_ID" ] && continue
        OUT="$TMP_DIR/$RULE_ID-$LANG.sarif"
        STATUS="$STATUS_DIR/$RULE_ID-$LANG.rc"
        RAN=$((RAN + 1))
        printf "    ▸ %-30s %-12s ... " "$RULE_ID" "$LANG"
        rc=$(cat "$STATUS" 2>/dev/null || echo "?")
        case "$rc" in
            0)   echo "✅ clean" ;;
            1)   COUNT=$(python3 -c "import json; print(len(json.load(open('$OUT'))['runs'][0]['results']))" 2>/dev/null || echo "?")
                 echo "❌ $COUNT raw finding(s)" ;;
            124) echo "⏱  timeout (>${CHECK_TIMEOUT}s)"; EXIT=2 ;;
            *)   echo "‼️  tool error (rc=$rc)"; EXIT=2 ;;
        esac
    done < "$WORK_LIST"
fi

echo ""
echo "    ────────────────────────────────────────────────"

# Merge all per-tool SARIF files into one (always SARIF here so
# post-processing can run; format conversion happens after)
python3 "$SCRIPT_DIR/scripts/merge-sarif.py" "$TMP_DIR" "$OUTPUT" "sarif"

# Apply suppressions, exclude-rules, baseline
POST_ARGS=(--sarif "$OUTPUT" --path "$PATH_ARG" --exclude-rules "$EXCLUDE_RULES")
[ -n "$BASELINE" ]         && POST_ARGS+=(--baseline "$BASELINE")
[ -n "$REFRESH_BASELINE" ] && POST_ARGS+=(--refresh-baseline "$REFRESH_BASELINE")

if python3 "$SCRIPT_DIR/scripts/post-process.py" "${POST_ARGS[@]}"; then
    POST_RC=0
else
    POST_RC=$?
fi

# If user requested text output, re-render from the post-processed SARIF
if [ "$FORMAT" = "text" ] && [ -z "$REFRESH_BASELINE" ]; then
    python3 - "$OUTPUT" <<'PY'
import json, sys
doc = json.load(open(sys.argv[1]))
total = 0
out_lines = []
for run in doc.get("runs", []):
    tool = run["tool"]["driver"]["name"]
    results = run.get("results", [])
    total += len(results)
    if not results:
        out_lines.append(f"✅ {tool}: clean")
        continue
    out_lines.append(f"❌ {tool}: {len(results)} finding(s)")
    for r in results:
        loc = r["locations"][0]["physicalLocation"]
        uri = loc["artifactLocation"]["uri"]
        line = loc["region"]["startLine"]
        out_lines.append(f"   [{r['level']}] {uri}:{line}  {r['ruleId']}  {r['message']['text']}")
out_lines.append("")
out_lines.append(f"Total: {total} finding(s)")
open(sys.argv[1], "w").write("\n".join(out_lines))
PY
fi

if [ -n "$REFRESH_BASELINE" ]; then
    echo "    📌 baseline refreshed → $REFRESH_BASELINE"
    echo "    🏁 ran $RAN check(s) — exit 0"
    exit 0
fi

if [ "$EXIT" -ne 2 ] && [ "$POST_RC" -eq 1 ]; then
    EXIT=1
fi

# ---- --split-by severity (B11): write per-severity SARIF siblings ----
if [ "$SPLIT_BY" = "severity" ] && [ "$FORMAT" = "sarif" ]; then
    OUT_DIR=$(dirname "$OUTPUT")
    OUT_BASE=$(basename "$OUTPUT" .sarif)
    python3 - "$OUTPUT" "$OUT_DIR" "$OUT_BASE" <<'PY'
import json, sys, copy
src, out_dir, out_base = sys.argv[1], sys.argv[2], sys.argv[3]
doc = json.load(open(src))
# SARIF severity levels we split on. Anything else lands in "other".
buckets = {"error": [], "warning": [], "note": [], "other": []}
template = copy.deepcopy(doc)
for run in template.get("runs", []):
    run["results"] = []
for run in doc.get("runs", []):
    for r in run.get("results", []):
        lvl = r.get("level", "warning")
        key = lvl if lvl in buckets else "other"
        buckets[key].append((run["tool"]["driver"]["name"], r))
for sev, items in buckets.items():
    if not items:
        continue
    bucket_doc = copy.deepcopy(template)
    by_tool = {}
    for tool, r in items:
        by_tool.setdefault(tool, []).append(r)
    for run in bucket_doc.get("runs", []):
        tool = run["tool"]["driver"]["name"]
        run["results"] = by_tool.get(tool, [])
    path = f"{out_dir}/{out_base}.{sev}.sarif" if out_dir not in ("", ".") else f"{out_base}.{sev}.sarif"
    with open(path, "w") as f:
        json.dump(bucket_doc, f, indent=2)
    print(f"    🪓 split → {path} ({len(items)} finding(s))")
PY
fi

ELAPSED=$(( $(date +%s) - START_EPOCH ))
echo "    ⏱  total wall time: ${ELAPSED}s"
echo "    📄 merged → $OUTPUT"
echo "    🏁 ran $RAN check(s) — exit $EXIT"
exit "$EXIT"
