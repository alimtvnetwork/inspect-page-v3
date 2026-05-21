"""Shared markdown link extraction + resolution.

Used by SPEC-LINK-001 (and reusable for any future doc link checker).

Scope: only **relative** markdown links are validated. External links
(`http://`, `https://`, `mailto:`, `tel:`, `ftp://`) are out of scope —
this checker does not make network calls. Pure-anchor links (`#section`)
are validated against the *current file's* headings.

Heading slug algorithm matches GitHub-flavored markdown:
  1. Lowercase
  2. Strip everything except `[a-z0-9 _-]`
  3. Replace spaces with hyphens
  4. Disambiguate duplicates with `-1`, `-2`, ... suffix

Code fences (``` and ~~~) are skipped so links inside example snippets
do not produce false positives. ATX headings (`# Foo`) are recognised;
setext (`Foo\n===`) is **not** recognised — spec uses ATX exclusively
per documentation-standards memory.

Spec: spec/02-coding-guidelines/06-cicd-integration/* (new SPEC-LINK-001 rule)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


EXTENSIONS = (".md",)

_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
_FENCE_RE = re.compile(r"^(`{3,}|~{3,})")
_EXTERNAL_PREFIXES = (
    "http://", "https://", "mailto:", "tel:", "ftp://", "ftps://", "javascript:",
    # Lovable memory pseudo-protocol — referenced from prose, never resolved on disk.
    "mem://",
)
# Heuristic: targets that look like inline code identifiers (no path separator,
# no extension, no hash) are almost always prose patterns like `[err](err)`
# from `[name](type)` documentation conventions, not real links.
_IDENT_LIKE_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_.()*]*$")


@dataclass(frozen=True)
class LinkRef:
    line: int
    text: str
    target_path: str  # path portion (may be empty for pure-anchor)
    anchor: str | None  # without '#'; None when no anchor


@dataclass(frozen=True)
class BrokenLink:
    line: int
    message: str


def extract_links(text: str) -> list[LinkRef]:
    """Return every relative markdown link, skipping fenced code blocks."""
    out: list[LinkRef] = []
    in_fence = False
    fence_marker = ""
    for lineno, raw in enumerate(text.splitlines(), start=1):
        fence_match = _FENCE_RE.match(raw.lstrip())
        if fence_match:
            marker = fence_match.group(1)[0] * 3
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif raw.lstrip().startswith(fence_marker):
                in_fence = False
            continue
        if in_fence:
            continue
        for m in _LINK_RE.finditer(raw):
            target = m.group(2).strip()
            if _is_external(target):
                continue
            path_part, anchor = _split_anchor(target)
            if _looks_like_inline_identifier(path_part, anchor):
                continue
            out.append(
                LinkRef(line=lineno, text=m.group(1), target_path=path_part, anchor=anchor)
            )
    return out


def extract_heading_slugs(text: str) -> set[str]:
    """Return the set of GitHub-style slugs for every ATX heading."""
    counts: dict[str, int] = {}
    slugs: set[str] = set()
    in_fence = False
    fence_marker = ""
    for raw in text.splitlines():
        fence_match = _FENCE_RE.match(raw.lstrip())
        if fence_match:
            marker = fence_match.group(1)[0] * 3
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif raw.lstrip().startswith(fence_marker):
                in_fence = False
            continue
        if in_fence:
            continue
        m = _HEADING_RE.match(raw)
        if not m:
            continue
        base = _slugify(m.group(2))
        seen = counts.get(base, 0)
        slug = base if seen == 0 else f"{base}-{seen}"
        counts[base] = seen + 1
        slugs.add(slug)
    return slugs


def check_file(
    path: Path,
    *,
    root: Path,
    slug_cache: dict[Path, set[str]],
) -> list[BrokenLink]:
    """Validate every relative link in `path`. Returns broken-link findings."""
    text = path.read_text(encoding="utf-8", errors="replace")
    self_slugs = _cached_slugs(path, text, slug_cache)
    out: list[BrokenLink] = []
    for link in extract_links(text):
        problem = _resolve(link, source=path, root=root, self_slugs=self_slugs, slug_cache=slug_cache)
        if problem is not None:
            out.append(BrokenLink(line=link.line, message=problem))
    return out


def _resolve(
    link: LinkRef,
    *,
    source: Path,
    root: Path,
    self_slugs: set[str],
    slug_cache: dict[Path, set[str]],
) -> str | None:
    if link.target_path == "":
        return _check_anchor_self(link, self_slugs)
    target = (source.parent / link.target_path).resolve()
    if not target.exists():
        return f"Broken link: target file not found: '{link.target_path}'"
    if link.anchor is None:
        return None
    if target.suffix.lower() not in EXTENSIONS:
        return None  # only validate anchors inside markdown files
    target_text = target.read_text(encoding="utf-8", errors="replace")
    target_slugs = _cached_slugs(target, target_text, slug_cache)
    if link.anchor not in target_slugs:
        return f"Broken anchor: '#{link.anchor}' not found in '{link.target_path}'"
    return None


def _check_anchor_self(link: LinkRef, self_slugs: set[str]) -> str | None:
    if link.anchor is None:
        return "Empty link target"
    if link.anchor in self_slugs:
        return None
    return f"Broken anchor: '#{link.anchor}' not found in this file"


def _cached_slugs(path: Path, text: str, cache: dict[Path, set[str]]) -> set[str]:
    key = path.resolve()
    if key not in cache:
        cache[key] = extract_heading_slugs(text)
    return cache[key]


def _looks_like_inline_identifier(path_part: str, anchor: str | None) -> bool:
    """Return True for `[name](type)` prose patterns (not real links).

    Heuristic: target has no path separator, no extension, no anchor, and
    matches an identifier-ish shape. These appear in spec prose like
    `assign [val](apperror.AppError)` and would otherwise produce a flood
    of false positives. Real file links almost always contain `/`, `.`, or
    a fragment.
    """
    if anchor is not None:
        return False
    if "/" in path_part or "\\" in path_part:
        return False
    if "." in path_part and not path_part.endswith("."):
        # Allow `foo.md`, `foo.png`, etc. as real file references.
        suffix = path_part.rsplit(".", 1)[-1].lower()
        if suffix.isalpha() and 1 <= len(suffix) <= 5:
            return False
    return bool(_IDENT_LIKE_RE.match(path_part))


def _split_anchor(target: str) -> tuple[str, str | None]:
    if "#" not in target:
        return target, None
    path_part, _, anchor = target.partition("#")
    return path_part, anchor or None


def _is_external(target: str) -> bool:
    lowered = target.lower()
    return any(lowered.startswith(p) for p in _EXTERNAL_PREFIXES)


def _slugify(heading: str) -> str:
    """GitHub-flavored heading slug.

    Algorithm (matches `gfm.kramdown` behaviour used by GitHub):
      1. Lowercase
      2. Strip everything except `[a-z0-9 _-]` (drops em-dash, `&`, etc.)
      3. Replace spaces with hyphens
    Note: consecutive hyphens are **preserved** — `Phase 1 — AI` becomes
    `phase-1--ai` (em-dash strips to "", surrounding spaces both convert
    to hyphens). Collapsing them was a bug that produced false positives
    on every "X — Y" / "X & Y" heading in the spec.
    """
    text = heading.lower()
    text = re.sub(r"[^a-z0-9 _-]", "", text)
    text = text.replace(" ", "-")
    return text.strip("-")


def is_in_scope(path: Path) -> bool:
    return path.suffix.lower() in EXTENSIONS
