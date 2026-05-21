#!/usr/bin/env python3
"""CODE-RED-001 — No nested if. PHP plugin (B7 bootstrap).

Heuristic: count `if (` openings inside a single function body; flag any
nested `if` (an `if` whose enclosing `{` was opened inside another `if`).
This is a pragmatic regex/brace-tracker, not a full PHP AST. Edge cases
(closures, match, ternary) are intentionally out of scope for v1.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.per_file_timeout import PerFileTimeout, per_file_timeout
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="CODE-RED-001",
    name="NoNestedIf",
    short_description="Nested `if` statements are forbidden — use guard clauses.",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
EXTENSIONS = [".php"]
IF_RE = re.compile(r"\bif\s*\(")


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    try:
        with per_file_timeout(seconds=2):
            text = path.read_text(encoding="utf-8", errors="replace")
    except PerFileTimeout:
        return findings
    depth_stack: list[bool] = []  # True = this brace level was opened by `if`
    line_no = 1
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "\n":
            line_no += 1
            i += 1
            continue
        if ch == "{":
            opened_by_if = _ends_with_if(text, i)
            if opened_by_if and any(depth_stack):
                findings.append(Finding(
                    rule_id=RULE.id, level="error",
                    message="Nested `if` detected — refactor with guard clauses.",
                    file_path=relpath(path, root), start_line=line_no,
                ))
            depth_stack.append(opened_by_if)
            i += 1
            continue
        if ch == "}":
            if depth_stack:
                depth_stack.pop()
            i += 1
            continue
        i += 1
    return findings


def _ends_with_if(text: str, brace_idx: int) -> bool:
    head = text[max(0, brace_idx - 200):brace_idx]
    return bool(IF_RE.search(head))


def main() -> int:
    args = build_parser("CODE-RED-001 nested-if (php)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-nested-if-php", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
