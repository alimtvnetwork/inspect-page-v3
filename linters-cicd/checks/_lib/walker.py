"""File walker that respects .gitignore basics, language extensions, and user-defined globs.

`exclude_globs` (v3.20.0) is a list of fnmatch-style patterns matched
against repo-relative posix paths (e.g. `vendor/**`, `**/*.gen.go`).
Patterns may target directories or individual files; matching short-circuits
on the first hit.

Spec: spec/02-coding-guidelines/06-cicd-integration/07-performance.md §2
"""

from __future__ import annotations

import fnmatch
import os
from pathlib import Path
from typing import Iterable, Sequence


SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", "vendor", "__pycache__",
    ".next", ".nuxt", ".cache", "target", "bin", "obj", ".venv", "venv",
    "release-artifacts", "coverage",
}


def walk_files(
    root: str,
    extensions: Iterable[str],
    exclude_globs: Sequence[str] | None = None,
) -> list[Path]:
    """Return files under root whose suffix matches one of extensions.

    Files (and directory subtrees) whose repo-relative posix path matches
    any glob in `exclude_globs` are skipped. Directory pruning happens at
    `os.walk` time so excluded subtrees don't pay the recursion cost.
    """
    exts = tuple(e.lower() for e in extensions)
    globs = tuple(exclude_globs or ())
    root_path = Path(root).resolve()
    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root_path):
        dirnames[:] = _filter_dirs(dirpath, dirnames, root_path, globs)
        for name in filenames:
            if not name.lower().endswith(exts):
                continue
            full = Path(dirpath) / name
            if _matches_any(_relposix(full, root_path), globs):
                continue
            out.append(full)
    return out


def walk_files_middle_out(
    root: str,
    extensions: Iterable[str],
    exclude_globs: Sequence[str] | None = None,
) -> list[Path]:
    """Walk files and reorder them median-first, alternating outward."""
    files = walk_files(root, extensions, exclude_globs)
    files.sort(key=_safe_size)
    return _middle_out(files)


def _filter_dirs(
    dirpath: str,
    dirnames: list[str],
    root_path: Path,
    globs: tuple[str, ...],
) -> list[str]:
    keep: list[str] = []
    for d in dirnames:
        if d in SKIP_DIRS or d.startswith("."):
            continue
        rel = _relposix(Path(dirpath) / d, root_path)
        if _matches_any(rel, globs) or _matches_any(rel + "/", globs):
            continue
        keep.append(d)
    return keep


def _matches_any(rel: str, globs: tuple[str, ...]) -> bool:
    if not globs:
        return False
    for pattern in globs:
        if fnmatch.fnmatch(rel, pattern):
            return True
    return False


def _relposix(p: Path, root: Path) -> str:
    try:
        rel = p.resolve().relative_to(root)
    except ValueError:
        return p.as_posix()
    return rel.as_posix()


def _safe_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


def _middle_out(items: list[Path]) -> list[Path]:
    """Reorder a sorted list median-first: D, E, C, F, B, G, A for [A..G]."""
    if not items:
        return []
    median = len(items) // 2
    out: list[Path] = [items[median]]
    right, left = median + 1, median - 1
    while right < len(items) or left >= 0:
        if right < len(items):
            out.append(items[right])
            right += 1
        if left >= 0:
            out.append(items[left])
            left -= 1
    return out


def relpath(p: Path, root: str) -> str:
    """Return p relative to root, posix-style for SARIF."""
    return str(p.resolve().relative_to(Path(root).resolve())).replace(os.sep, "/")
