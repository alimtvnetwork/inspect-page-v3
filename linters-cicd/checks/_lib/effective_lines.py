"""Single source of truth: count "effective lines" of a function body.

Used by both CODE-RED-004 (hard cap 15) and CODE-RED-005 (strict cap 8)
across every supported language. The JS mirror lives at
``eslint-plugins/coding-guidelines/_lib/effective-lines.js`` and a
fixture-driven parity test asserts they agree byte-for-byte.

Canonical prose spec (the source of truth for *meaning*):
    linters-cicd/checks/function-length-prefer8/README.md  §2

Definition (applies to ALL languages):
    A line is "effective" iff, after ``.strip()``, it is NOT one of:
      * empty / whitespace-only
      * a single-line comment (per-language token, see SYNTAX below)
      * a block-comment open / continuation / close (state-tracked)
      * a docstring opener/closer line (Python only — single-line
        triple-quote opener/closer; prose lines INSIDE a multi-line
        docstring DO count, matching prior CODE-RED-005 Python scanner
        behavior)

The function signature line and the closing brace/dedent are NEVER
passed to this counter — callers extract the body slice themselves.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class CommentSyntax:
    """Per-language comment tokens. ``block_open``/``block_close`` may
    be ``None`` for languages without block comments (Python)."""
    line_tokens: tuple[str, ...]          # e.g. ("//",) or ("#",) or ("//", "///")
    block_open: str | None                # e.g. "/*"
    block_close: str | None               # e.g. "*/"
    docstring_tokens: tuple[str, ...] = ()  # Python only


# Python docstring delimiters — kept as a module-level constant so the
# string-literal tokens don't appear inline inside SYNTAX (which would
# trip up tokenizers that get confused by adjacent triple-quote runs).
_PY_DOCSTRING = (chr(34) * 3, chr(39) * 3)


# Single registry — every supported language goes through here.
SYNTAX: dict[str, CommentSyntax] = {
    "go":         CommentSyntax(line_tokens=("//",),         block_open="/*", block_close="*/"),
    "typescript": CommentSyntax(line_tokens=("//",),         block_open="/*", block_close="*/"),
    "javascript": CommentSyntax(line_tokens=("//",),         block_open="/*", block_close="*/"),
    "rust":       CommentSyntax(line_tokens=("//", "///"),   block_open="/*", block_close="*/"),
    "php":        CommentSyntax(line_tokens=("//", "#"),     block_open="/*", block_close="*/"),
    "python":     CommentSyntax(line_tokens=("#",),          block_open=None, block_close=None,
                                docstring_tokens=_PY_DOCSTRING),
}


def count_effective(body_lines: Iterable[str], language: str) -> int:
    """Return the count of effective lines in ``body_lines`` for ``language``.

    ``body_lines`` is the slice of source lines STRICTLY BETWEEN the
    function's opening brace/colon line and its closing brace/dedent
    line — neither of those lines is included by callers.

    Raises ``KeyError`` if ``language`` is not registered. This is
    intentional: silently treating an unknown language as "no comments"
    would mask scanner-wiring bugs.
    """
    syntax = SYNTAX[language]
    count = 0
    in_block = False
    for raw in body_lines:
        stripped = raw.strip()
        if not stripped:
            continue
        if in_block:
            if syntax.block_close and syntax.block_close in stripped:
                in_block = False
            continue
        if syntax.block_open and stripped.startswith(syntax.block_open):
            # Single-line block comment ("/* foo */") — already closed on
            # this line; either way the line itself is comment-only and
            # does not count.
            if syntax.block_close and syntax.block_close not in stripped[len(syntax.block_open):]:
                in_block = True
            continue
        if any(stripped.startswith(tok) for tok in syntax.line_tokens):
            continue
        if any(stripped.startswith(tok) for tok in syntax.docstring_tokens):
            # Lines that open/close a docstring are not counted. Lines
            # in the middle of a multi-line docstring DO count — full
            # docstring tracking is out of scope (see README §2).
            continue
        count += 1
    return count
