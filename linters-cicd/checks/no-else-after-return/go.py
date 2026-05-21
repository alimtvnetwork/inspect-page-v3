#!/usr/bin/env python3
"""STYLE-002 — No `else` after `return`/`throw`/`break`/`continue`. Go."""

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
TERMINATOR_RE = re.compile(r"^\s*(?:return|panic|break|continue)\b")
ELSE_RE = re.compile(r"^\s*}\s*else\b")


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for i in range(len(lines) - 1):
        if not TERMINATOR_RE.match(lines[i]):
            continue
        # look for closing } else within next 3 lines
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
    args = build_parser("STYLE-002 no-else-after-return (Go)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-no-else-after-return-go", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".go"], exclude_globs=_globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
