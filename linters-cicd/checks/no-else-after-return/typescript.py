#!/usr/bin/env python3
"""STYLE-002 — No `else` after `return`/`throw`. TypeScript / JavaScript."""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="STYLE-002",
    name="NoElseAfterReturn",
    short_description="Avoid `else` after `return` / `throw` / `break` / `continue`.",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
TERMINATOR_RE = re.compile(r"^\s*(?:return|throw|break|continue)\b")
ELSE_RE = re.compile(r"^\s*}\s*else\b")


def strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    src = re.sub(r"//[^\n]*", "", src)
    return src


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = strip_comments(path.read_text(encoding="utf-8", errors="replace")).splitlines()
    for i in range(len(lines) - 1):
        if not TERMINATOR_RE.match(lines[i]):
            continue
        for k in range(1, 4):
            if i + k >= len(lines):
                break
            if ELSE_RE.match(lines[i + k]):
                findings.append(
                    Finding(
                        rule_id=RULE.id,
                        level="warning",
                        message="`else` after terminating statement — drop the `else`.",
                        file_path=relpath(path, root),
                        start_line=i + k + 1,
                    )
                )
                break
    return findings


def main() -> int:
    args = build_parser("STYLE-002 no-else-after-return (TS/JS)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-no-else-after-return-ts", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], exclude_globs=_globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
