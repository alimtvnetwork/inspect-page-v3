#!/usr/bin/env python3
"""CODE-RED-005 — Prefer-8 function length. PHP."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.per_file_timeout import PerFileTimeout, per_file_timeout
from _lib.sarif import Finding, SarifRun, emit
from _lib.walker import walk_files

from _shared import RULE, exceeds_strict_cap, load_sibling, make_finding

_sibling = load_sibling("php")
EXTENSIONS = _sibling.EXTENSIONS
SIG_RE = _sibling.SIG_RE
PLAIN_RE = _sibling.PLAIN_RE
_count_effective = _sibling._count_effective


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    try:
        with per_file_timeout(seconds=2):
            text = path.read_text(encoding="utf-8", errors="replace")
    except PerFileTimeout:
        return findings
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        match = SIG_RE.match(lines[i]) or PLAIN_RE.match(lines[i])
        if not match:
            i += 1
            continue
        end = _find_body_end(lines, i)
        effective = _count_effective(lines[i + 1:end])
        if exceeds_strict_cap(effective):
            findings.append(make_finding(match.group(1), effective, path, root, i + 1))
        i = end + 1
    return findings


def _find_body_end(lines: list[str], start: int) -> int:
    depth = lines[start].count("{") - lines[start].count("}")
    end = start
    for j in range(start + 1, len(lines)):
        depth += lines[j].count("{") - lines[j].count("}")
        if depth <= 0:
            end = j
            break
    return end


def main() -> int:
    args = build_parser("CODE-RED-005 function-length-prefer8 (PHP)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-function-length-prefer8-php", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
