#!/usr/bin/env python3
"""CODE-RED-006 — File length ≤ 300 lines. Universal (all source extensions)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.per_file_timeout import PerFileTimeout, per_file_timeout
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="CODE-RED-006",
    name="FileLength",
    short_description="Source files must not exceed 300 lines.",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)
MAX_LINES = 300
EXTENSIONS = [
    ".go", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".php", ".rs", ".java", ".kt", ".swift", ".cs",
]


def scan(path: Path, root: str) -> Finding | None:
    try:
        with per_file_timeout(seconds=2):
            text = path.read_text(encoding="utf-8", errors="replace")
            n = text.count("\n") + (0 if text.endswith("\n") else 1)
    except PerFileTimeout:
        return Finding(
            rule_id=RULE.id,
            level="warning",
            message="Skipped — read exceeded per-file 2s timeout.",
            file_path=relpath(path, root),
            start_line=1,
        )
    if n <= MAX_LINES:
        return None
    return Finding(
        rule_id=RULE.id,
        level="error",
        message=f"File has {n} lines (max {MAX_LINES}) — split by responsibility.",
        file_path=relpath(path, root),
        start_line=MAX_LINES + 1,
    )


def main() -> int:
    args = build_parser("CODE-RED-006 file-length (universal)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-file-length", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=_globs):
        finding = scan(f, args.path)
        if finding:
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
