#!/usr/bin/env python3
"""CODE-RED-004 — Function length 8–15 lines (effective). Go."""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.effective_lines import count_effective as _count_effective_shared
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="CODE-RED-004",
    name="FunctionLength",
    short_description="Functions must be 8–15 effective lines (excluding blanks/comments).",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
MAX_LINES = 15
FUNC_RE = re.compile(r"^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)[^{]*\{")


def count_effective(lines: list[str]) -> int:
    """Thin wrapper kept for backwards-compat with CODE-RED-005's
    ``load_sibling`` callers. The single source of truth lives in
    ``linters-cicd/checks/_lib/effective_lines.py``."""
    return _count_effective_shared(lines, "go")


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    while i < len(lines):
        m = FUNC_RE.match(lines[i])
        if not m:
            i += 1
            continue
        name = m.group(1)
        depth = lines[i].count("{") - lines[i].count("}")
        body_start = i + 1
        j = i + 1
        while j < len(lines) and depth > 0:
            depth += lines[j].count("{") - lines[j].count("}")
            j += 1
        body_lines = lines[body_start: j - 1]
        effective = count_effective(body_lines)
        if effective > MAX_LINES:
            findings.append(
                Finding(
                    rule_id=RULE.id,
                    level="error",
                    message=f"Function '{name}' has {effective} effective lines (max {MAX_LINES}).",
                    file_path=relpath(path, root),
                    start_line=i + 1,
                )
            )
        i = j
    return findings


def main() -> int:
    args = build_parser("CODE-RED-004 function-length (Go)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-function-length-go", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".go"], exclude_globs=_globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
