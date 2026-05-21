#!/usr/bin/env python3
"""CODE-RED-002 — Boolean naming. PHP plugin (B7 bootstrap).

Flags `bool` typed properties / parameters whose name does not start with
one of the approved prefixes (`is`, `has`, `can`, `should`, `will`,
`did`, `was`, `are`, `does`).
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
    id="CODE-RED-002",
    name="BooleanNaming",
    short_description="Boolean identifiers must use an approved positive prefix.",
    help_uri_relative="01-cross-language/02-boolean-principles/00-overview.md",
)
EXTENSIONS = [".php"]
APPROVED = ("is", "has", "can", "should", "will", "did", "was", "are", "does")
DECL_RE = re.compile(r"\bbool\s+\$([A-Za-z_][A-Za-z0-9_]*)\b")


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    try:
        with per_file_timeout(seconds=2):
            text = path.read_text(encoding="utf-8", errors="replace")
    except PerFileTimeout:
        return findings
    for line_no, line in enumerate(text.splitlines(), start=1):
        for match in DECL_RE.finditer(line):
            name = match.group(1)
            if not _has_approved_prefix(name):
                findings.append(Finding(
                    rule_id=RULE.id, level="error",
                    message=f"Boolean `${name}` lacks an approved prefix ({', '.join(APPROVED)}).",
                    file_path=relpath(path, root), start_line=line_no,
                ))
    return findings


def _has_approved_prefix(name: str) -> bool:
    lower = name[0].lower() + name[1:]
    return any(lower.startswith(p) and len(name) > len(p) and name[len(p)].isupper()
               for p in APPROVED) or any(lower == p for p in APPROVED)


def main() -> int:
    args = build_parser("CODE-RED-002 boolean-naming (php)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-boolean-naming-php", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
