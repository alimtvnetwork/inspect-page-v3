#!/usr/bin/env python3
"""CODE-RED-004 — Function length. PHP plugin (B7 bootstrap).

Counts effective lines (excluding blanks and `// …` / `# …` comments)
inside each `function name(...) { ... }` body and flags >15.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.effective_lines import count_effective as _count_effective_shared
from _lib.per_file_timeout import PerFileTimeout, per_file_timeout
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="CODE-RED-004",
    name="FunctionLength",
    short_description="Functions must be 8–15 effective lines (excluding blanks/comments).",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
MAX_LINES = 15
EXTENSIONS = [".php"]
SIG_RE = re.compile(r"^\s*(?:public|private|protected|static|final|abstract)\s*(?:public|private|protected|static|final|abstract)?\s*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)[^{]*\{")
PLAIN_RE = re.compile(r"^\s*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)[^{]*\{")


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
        body_start = i
        depth = lines[i].count("{") - lines[i].count("}")
        end = i
        for j in range(i + 1, len(lines)):
            depth += lines[j].count("{") - lines[j].count("}")
            if depth <= 0:
                end = j
                break
        effective = _count_effective(lines[body_start + 1:end])
        if effective > MAX_LINES:
            findings.append(Finding(
                rule_id=RULE.id, level="error",
                message=f"Function `{match.group(1)}` has {effective} effective lines (max {MAX_LINES}).",
                file_path=relpath(path, root), start_line=body_start + 1,
            ))
        i = end + 1
    return findings


def _count_effective(body: list[str]) -> int:
    """Thin wrapper kept for backwards-compat with CODE-RED-005's
    ``load_sibling`` callers. The single source of truth lives in
    ``linters-cicd/checks/_lib/effective_lines.py``."""
    return _count_effective_shared(body, "php")


def main() -> int:
    args = build_parser("CODE-RED-004 function-length (php)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-function-length-php", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
