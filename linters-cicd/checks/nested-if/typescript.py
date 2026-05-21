#!/usr/bin/env python3
"""CODE-RED-001 — No nested `if`. TypeScript / JavaScript implementation."""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="CODE-RED-001",
    name="NoNestedIf",
    short_description="Nested if statements are forbidden — flatten with guard clauses.",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
IF_RE = re.compile(r"^\s*}?\s*(?:else\s+)?if\s*\([^)]*\)\s*\{")


def strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    src = re.sub(r"//[^\n]*", "", src)
    return src


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
    depth = 0
    for i, line in enumerate(text.splitlines(), start=1):
        if IF_RE.search(line):
            depth += 1
            if depth >= 2:
                findings.append(
                    Finding(
                        rule_id=RULE.id,
                        level="error",
                        message=f"Nested if at depth {depth} — extract guard clauses.",
                        file_path=relpath(path, root),
                        start_line=i,
                    )
                )
        depth += line.count("{") - line.count("}") - (1 if IF_RE.search(line) else 0)
        if depth < 0:
            depth = 0
    return findings


def main() -> int:
    args = build_parser("CODE-RED-001 nested-if (TS/JS)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-nested-if-ts", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], exclude_globs=_globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
