#!/usr/bin/env python3
"""TEMPLATE-001 — Forbid leftover var_dump()/print_r() debug calls (PHP).

This file is a CANONICAL TEMPLATE for new linter rules. It compiles,
runs through run-all.sh, and emits SARIF 2.1.0 — but it is NOT
registered in checks/registry.json by default. Copy this folder to
``checks/<your-rule-slug>/`` and follow the steps in
``checks/_template/README.md``.

Why this rule?
    var_dump() and print_r() are debugging tools that frequently leak
    into production. They expose internal state, slow rendering, and
    sometimes break content-type negotiation. Easy to detect, easy to
    fix — perfect example payload.

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
RULE = Rule(
    id="TEMPLATE-001",
    name="LeftoverDebugCall",
    short_description=(
        "Remove var_dump() / print_r() / error_log() debug calls "
        "before merging to main."
    ),
    help_uri_relative=(
        "02-coding-guidelines/06-cicd-integration/02-plugin-model.md"
    ),
)

# ── Step 2: Compile your detection regexes (or AST visitors). ─────────
# Keep the pattern strict enough to avoid false positives. Anchor on
# word boundaries; never match inside comments or string literals
# without first stripping them (see strip_comments() below).
DEBUG_CALL_RE = re.compile(
    r"\b(?P<fn>var_dump|print_r|error_log|var_export)\s*\(",
)


# ── Step 3: Strip comments BEFORE scanning. Always. ───────────────────
# Most false positives come from matching inside comments or doc
# blocks. The shared lib has no PHP-specific stripper, so each check
# rolls its own at minimum effort.
def strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    src = re.sub(r"//[^\n]*", "", src)
    src = re.sub(r"#[^\n]*", "", src)
    return src


# ── Step 4: scan() returns a list[Finding]. One per violation. ────────
def scan(path: Path, root: str):
    text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
    findings = []
    for m in DEBUG_CALL_RE.finditer(text):
        line = text.count("\n", 0, m.start()) + 1
        findings.append(
            Finding(
                rule_id=RULE.id,
                level="warning",   # use "error" for must-block rules
                message=(
                    f"`{m.group('fn')}()` debug call left in source — "
                    f"remove before merging."
                ),
                file_path=relpath(path, root),
                start_line=line,
            )
        )
    return findings


# ── Step 5: main() wires CLI → walker → scan() → SARIF emit. ──────────
# This block is identical in every check. Only change the tool_name
# and the file extensions in walk_files().
def main() -> int:
    args = build_parser("TEMPLATE-001 leftover debug calls (PHP)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-template-leftover-debug-php",
        tool_version="1.0.0",
        rules=[RULE],
    )
    for f in walk_files(args.path, [".php"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
