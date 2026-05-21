#!/usr/bin/env python3
"""CODE-RED-005 — Prefer-8 function length. Go."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, SarifRun, emit
from _lib.walker import walk_files

from _shared import RULE, exceeds_strict_cap, load_sibling, make_finding

_sibling = load_sibling("go")
FUNC_RE = _sibling.FUNC_RE
count_effective = _sibling.count_effective


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    while i < len(lines):
        m = FUNC_RE.match(lines[i])
        if not m:
            i += 1
            continue
        end_idx = _find_body_end(lines, i)
        body_lines = lines[i + 1:end_idx - 1]
        effective = count_effective(body_lines)
        if exceeds_strict_cap(effective):
            findings.append(make_finding(m.group(1), effective, path, root, i + 1))
        i = end_idx
    return findings


def _find_body_end(lines: list[str], start: int) -> int:
    depth = lines[start].count("{") - lines[start].count("}")
    j = start + 1
    while j < len(lines) and depth > 0:
        depth += lines[j].count("{") - lines[j].count("}")
        j += 1
    return j


def main() -> int:
    args = build_parser("CODE-RED-005 function-length-prefer8 (Go)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-function-length-prefer8-go", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".go"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
