#!/usr/bin/env python3
"""TEMPLATE-001 — Forbid leftover console.* / debugger debug calls (TS/JS).

Sibling of ``php.py`` in the same starter kit. Same rule ID, same
intent ("don't ship debug output"), different language. Copy this
file alongside ``php.py`` when you need a multi-language rule, or
keep just one and delete the other when you don't.

Why this rule?
    ``console.log()`` / ``console.debug()`` / ``debugger`` statements
    routinely leak from local debugging into shipped bundles. They
    bloat output, expose internals, and break some embedding
    contexts (CSP, embedded iframes, SSR hydration). Easy to detect,
    easy to fix — perfect example payload, parallel to the PHP
    sibling that flags ``var_dump`` / ``print_r``.

Spec stub:
    spec/02-coding-guidelines/06-cicd-integration/02-plugin-model.md
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# ── Boilerplate: locate the shared helpers (do NOT change). ───────────
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths  # noqa: E402
from _lib.sarif import Finding, Rule, SarifRun, emit  # noqa: E402
from _lib.walker import relpath, walk_files  # noqa: E402

# ── Step 1: Declare the rule metadata. ────────────────────────────────
# Identical to the PHP sibling: same id/name/help so SARIF consumers
# (GitHub code-scanning, SonarQube) treat them as one logical rule
# with two language implementations.
RULE = Rule(
    id="TEMPLATE-001",
    name="LeftoverDebugCall",
    short_description=(
        "Remove console.log/debug/info/warn/error and debugger "
        "statements before merging to main."
    ),
    help_uri_relative=(
        "02-coding-guidelines/06-cicd-integration/02-plugin-model.md"
    ),
)

# ── Step 2: Compile your detection regexes (or AST visitors). ─────────
# `console.<method>(` covers the common shapes; bare `debugger;` gets
# its own anchor so we do not accidentally match `mydebugger`.
# Keep the pattern strict — never match inside comments or string
# literals without first stripping them (see strip_comments_and_strings).
CONSOLE_CALL_RE = re.compile(
    r"\bconsole\s*\.\s*(?P<fn>log|debug|info|warn|error|trace|dir)\s*\(",
)
DEBUGGER_RE = re.compile(r"(?<![A-Za-z0-9_$])debugger\s*;")


# ── Step 3: Strip comments AND string literals BEFORE scanning. ───────
# TypeScript needs both layers because most false positives come from
# log lines inside strings (e.g. `throw new Error("console.log fired")`).
# We replace stripped regions with spaces so character offsets — and
# therefore line numbers — are preserved exactly.
def strip_comments_and_strings(src: str) -> str:
    def _blank(match: re.Match[str]) -> str:
        # Preserve newlines so finditer line counts match the original.
        return re.sub(r"[^\n]", " ", match.group(0))

    # Order matters: block comments first (they may contain // or "),
    # then line comments, then string/template literals.
    src = re.sub(r"/\*.*?\*/", _blank, src, flags=re.DOTALL)
    src = re.sub(r"//[^\n]*", _blank, src)
    # Single-quoted, double-quoted, and template literals. The
    # template-literal pattern intentionally does NOT recurse into
    # ${...} interpolations — a real call inside an interpolation is
    # still real code that should be flagged.
    src = re.sub(r"'(?:\\.|[^'\\\n])*'", _blank, src)
    src = re.sub(r'"(?:\\.|[^"\\\n])*"', _blank, src)
    src = re.sub(r"`(?:\\.|[^`\\])*`", _blank, src, flags=re.DOTALL)
    return src


# ── Step 4: scan() returns a list[Finding]. One per violation. ────────
def scan(path: Path, root: str) -> list[Finding]:
    text = strip_comments_and_strings(
        path.read_text(encoding="utf-8", errors="replace")
    )
    findings: list[Finding] = []
    rel = relpath(path, root)
    for m in CONSOLE_CALL_RE.finditer(text):
        line = text.count("\n", 0, m.start()) + 1
        findings.append(
            Finding(
                rule_id=RULE.id,
                level="warning",   # use "error" for must-block rules
                message=(
                    f"`console.{m.group('fn')}()` debug call left in source "
                    f"— remove or replace with the project logger."
                ),
                file_path=rel,
                start_line=line,
            )
        )
    for m in DEBUGGER_RE.finditer(text):
        line = text.count("\n", 0, m.start()) + 1
        findings.append(
            Finding(
                rule_id=RULE.id,
                level="warning",
                message="`debugger;` statement left in source — remove before merging.",
                file_path=rel,
                start_line=line,
            )
        )
    findings.sort(key=lambda f: f.start_line)
    return findings


# ── Step 5: main() wires CLI → walker → scan() → SARIF emit. ──────────
# Identical shape to php.py — only the tool_name suffix and the file
# extensions differ.
def main() -> int:
    args = build_parser("TEMPLATE-001 leftover debug calls (TS/JS)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-template-leftover-debug-ts",
        tool_version="1.0.0",
        rules=[RULE],
    )
    for f in walk_files(
        args.path,
        [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
        exclude_globs=globs,
    ):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())