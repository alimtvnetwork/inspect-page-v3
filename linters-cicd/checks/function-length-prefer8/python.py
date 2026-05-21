#!/usr/bin/env python3
"""CODE-RED-005 — Prefer-8 function length. Python.

Counts effective body lines (skip blanks, ``#`` comments, and pure
docstrings on their own lines) inside each ``def`` / ``async def``.
Indentation-based body detection.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.effective_lines import count_effective as _count_effective_shared
from _lib.sarif import Finding, SarifRun, emit
from _lib.walker import walk_files
from _shared import RULE, exceeds_strict_cap, make_finding


DEF_RE = re.compile(r"^(\s*)(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(")


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    while i < len(lines):
        match = DEF_RE.match(lines[i])
        if not match:
            i += 1
            continue
        indent = len(match.group(1))
        end_idx = _find_body_end(lines, i + 1, indent)
        body = lines[i + 1:end_idx]
        effective = _count_effective(body)
        if exceeds_strict_cap(effective):
            findings.append(make_finding(match.group(2), effective, path, root, i + 1))
        i = end_idx
    return findings


def _find_body_end(lines: list[str], start: int, def_indent: int) -> int:
    j = start
    while j < len(lines):
        stripped = lines[j].strip()
        if stripped == "" or stripped.startswith("#"):
            j += 1
            continue
        line_indent = len(lines[j]) - len(lines[j].lstrip())
        if line_indent <= def_indent:
            return j
        j += 1
    return j


def _count_effective(body: list[str]) -> int:
    """Delegates to the unified counter in
    ``linters-cicd/checks/_lib/effective_lines.py``. Kept as a thin
    local wrapper so the scan loop reads cleanly and so any future
    test that imports this symbol keeps working."""
    return _count_effective_shared(body, "python")


def main() -> int:
    args = build_parser("CODE-RED-005 function-length-prefer8 (Python)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-function-length-prefer8-py", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".py"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
