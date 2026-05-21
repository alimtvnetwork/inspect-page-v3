#!/usr/bin/env python3
"""CODE-RED-003 — Magic strings. Go. Flags string literals appearing >= 2 times."""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="CODE-RED-003",
    name="MagicStrings",
    short_description="Repeated string literals must be promoted to a typed constant.",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
STRING_RE = re.compile(r'"((?:[^"\\]|\\.){2,})"')
MIN_OCCURRENCES = 2
IGNORE_PREFIXES = ("http://", "https://", "github.com/", "/", ".", "spec/")


def scan_file(path: Path, root: str) -> list[Finding]:
    text = path.read_text(encoding="utf-8", errors="replace")
    occurrences: dict[str, list[int]] = defaultdict(list)
    for i, raw in enumerate(text.splitlines(), start=1):
        line = raw.split("//", 1)[0]
        for m in STRING_RE.finditer(line):
            value = m.group(1)
            if any(value.startswith(p) for p in IGNORE_PREFIXES):
                continue
            occurrences[value].append(i)

    findings: list[Finding] = []
    for value, lines in occurrences.items():
        if len(lines) >= MIN_OCCURRENCES:
            findings.append(
                Finding(
                    rule_id=RULE.id,
                    level="error",
                    message=f'Magic string "{value}" appears {len(lines)} times — promote to constant.',
                    file_path=relpath(path, root),
                    start_line=lines[0],
                )
            )
    return findings


def main() -> int:
    args = build_parser("CODE-RED-003 magic-strings (Go)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-magic-strings-go", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".go"], exclude_globs=_globs):
        for finding in scan_file(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
