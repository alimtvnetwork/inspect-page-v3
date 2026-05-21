#!/usr/bin/env python3
"""CODE-RED-005 — Prefer-8 function length. Rust.

Brace-balanced body extraction for ``fn name(...) ... { ... }``.
Skips blank lines and ``//`` / ``///`` line comments; basic ``/* */``
block-comment handling matches the Go scanner.
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


FN_RE = re.compile(
    r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:const\s+)?fn\s+"
    r"([A-Za-z_][A-Za-z0-9_]*)"
)


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    while i < len(lines):
        match = FN_RE.match(lines[i])
        brace_idx = _find_opening_brace(lines, i)
        if not match or brace_idx == -1:
            i += 1
            continue
        end_idx = _find_body_end(lines, brace_idx)
        body = lines[brace_idx + 1:end_idx]
        effective = _count_effective(body)
        if exceeds_strict_cap(effective):
            findings.append(make_finding(match.group(1), effective, path, root, i + 1))
        i = max(end_idx + 1, i + 1)
    return findings


def _find_opening_brace(lines: list[str], start: int) -> int:
    j = start
    while j < len(lines) and j < start + 10:
        if "{" in lines[j]:
            return j
        if ";" in lines[j]:
            return -1
        j += 1
    return -1


def _find_body_end(lines: list[str], brace_line: int) -> int:
    depth = lines[brace_line].count("{") - lines[brace_line].count("}")
    j = brace_line + 1
    while j < len(lines) and depth > 0:
        depth += lines[j].count("{") - lines[j].count("}")
        j += 1
    return j - 1


def _count_effective(body: list[str]) -> int:
    """Delegates to the unified counter in
    ``linters-cicd/checks/_lib/effective_lines.py``. Kept as a thin
    local wrapper so the scan loop reads cleanly and so any future
    test that imports this symbol keeps working."""
    return _count_effective_shared(body, "rust")


def main() -> int:
    args = build_parser("CODE-RED-005 function-length-prefer8 (Rust)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-function-length-prefer8-rs", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".rs"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
