#!/usr/bin/env python3
"""CODE-RED-005 — Prefer-8 function length. TypeScript / JavaScript."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, SarifRun, emit
from _lib.walker import walk_files

from _shared import RULE, exceeds_strict_cap, load_sibling, make_finding

_sibling = load_sibling("typescript")
count_effective = _sibling.count_effective
match_function = _sibling.match_function


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    while i < len(lines):
        name = match_function(lines[i])
        if not name:
            i += 1
            continue
        end_idx = _find_body_end(lines, i)
        body_lines = lines[i + 1:end_idx - 1]
        effective = count_effective(body_lines)
        if exceeds_strict_cap(effective):
            findings.append(make_finding(name, effective, path, root, i + 1))
        i = max(end_idx, i + 1)
    return findings


def _find_body_end(lines: list[str], start: int) -> int:
    depth = lines[start].count("{") - lines[start].count("}")
    j = start + 1
    while j < len(lines) and depth > 0:
        depth += lines[j].count("{") - lines[j].count("}")
        j += 1
    return j


def main() -> int:
    args = build_parser("CODE-RED-005 function-length-prefer8 (TS/JS)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-function-length-prefer8-ts", tool_version="1.0.0", rules=[RULE])
    extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
    for f in walk_files(args.path, extensions, exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
