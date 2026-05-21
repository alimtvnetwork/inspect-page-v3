#!/usr/bin/env python3
"""CODE-RED-003 — Magic strings. PHP plugin (B7 bootstrap).

Flags string literals appearing inside `if`/`switch`/`return` that are
not declared as a `const` or `define()`. Length ≥ 3 to skip flags like
"y"/"n". Strings already used in `define()`/`const` declarations on the
same line are exempt.
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
    id="CODE-RED-003",
    name="MagicStrings",
    short_description="String literals in conditionals/returns must be named constants.",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
EXTENSIONS = [".php"]
TARGET_RE = re.compile(r"\b(?:if|switch|return)\b[^;]*?'([^'\\]{3,})'")
EXEMPT_RE = re.compile(r"\b(?:const|define)\b")


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    try:
        with per_file_timeout(seconds=2):
            text = path.read_text(encoding="utf-8", errors="replace")
    except PerFileTimeout:
        return findings
    for line_no, line in enumerate(text.splitlines(), start=1):
        if EXEMPT_RE.search(line):
            continue
        for match in TARGET_RE.finditer(line):
            literal = match.group(1)
            findings.append(Finding(
                rule_id=RULE.id, level="error",
                message=f"Magic string \"{literal}\" — extract to a named constant.",
                file_path=relpath(path, root), start_line=line_no,
            ))
    return findings


def main() -> int:
    args = build_parser("CODE-RED-003 magic-strings (php)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-magic-strings-php", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
