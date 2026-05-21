"""Common CLI parser used by every check script.

Every check inherits `--version` and `--exclude-paths` automatically.
The version string is `coding-guidelines/<rule-slug> <X.Y.Z>` where
`<rule-slug>` is the parent-directory name of the calling script
(e.g. `nested-if`) and `<X.Y.Z>` is read from `linters-cicd/VERSION`.

`--exclude-paths` accepts a CSV of fnmatch globs (e.g.
`vendor/**,**/*.gen.go`) which checks pass through to `walk_files`.

Spec: spec/02-coding-guidelines/06-cicd-integration/98-faq.md §4
"""

from __future__ import annotations

import argparse
import inspect
from pathlib import Path


def build_parser(description: str) -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=description)
    p.add_argument("--path", default=".", help="Directory to scan (default: .)")
    p.add_argument("--format", choices=["sarif", "text"], default="sarif")
    p.add_argument("--output", default=None, help="Write to file instead of stdout")
    p.add_argument(
        "--exclude-paths",
        default="",
        help="CSV of fnmatch globs to skip (e.g. 'vendor/**,**/*.gen.go')",
    )
    p.add_argument(
        "--version",
        action="version",
        version=_version_string(),
        help="Print 'coding-guidelines/<rule-slug> <X.Y.Z>' and exit",
    )
    return p


def parse_exclude_paths(raw: str) -> list[str]:
    """Split the --exclude-paths CSV into a clean list of globs."""
    if not raw:
        return []
    return [g.strip() for g in raw.split(",") if g.strip()]


def _version_string() -> str:
    return f"coding-guidelines/{_caller_slug()} {_pack_version()}"


def _caller_slug() -> str:
    """Derive the rule slug from the calling script's parent directory."""
    caller = _caller_path()
    if caller is None:
        return "unknown"
    return caller.resolve().parent.name


def _caller_path() -> Path | None:
    for frame in inspect.stack():
        filename = frame.filename
        if filename.endswith("cli.py"):
            continue
        if "checks/_lib" in filename.replace("\\", "/"):
            continue
        return Path(filename)
    return None


def _pack_version() -> str:
    version_file = Path(__file__).resolve().parents[2] / "VERSION"
    try:
        return version_file.read_text(encoding="utf-8").strip()
    except OSError:
        return "0.0.0"
