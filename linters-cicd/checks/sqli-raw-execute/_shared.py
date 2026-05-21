"""Shared regex helpers for SQLI-RAW-001 (rawExecute concatenation)."""
from __future__ import annotations

import re

# Match `rawExecute(`. Captures Orm::, $repo->, self::, static:: or bare call.
RAW_EXECUTE_CALL_RE = re.compile(
    r"\b(?:Orm::|self::|static::|\$[A-Za-z_][A-Za-z0-9_]*->)?rawExecute\s*\(",
    re.IGNORECASE,
)

# Inside the first argument we forbid:
#   - PHP string concatenation:   "SELECT " . $x   |   $x . "FROM"
#   - PHP variable interpolation in double-quoted strings: "SELECT $x"
#   - TS template literal with `${...}` interpolation
#   - TS string concatenation:   "SELECT " + x
#   - sprintf / str_replace style placeholders that bypass binding
CONCAT_PHP_RE = re.compile(r'"[^"\n]*"\s*\.\s*\$|\$[A-Za-z_]\w*\s*\.\s*"')
INTERP_PHP_RE = re.compile(r'"[^"]*\$[A-Za-z_]\w*[^"]*"')
CONCAT_TS_RE = re.compile(r'''(["'])[^"'\n]*\1\s*\+\s*[A-Za-z_$]''')
TEMPLATE_TS_RE = re.compile(r"`[^`]*\$\{[^}]+\}[^`]*`")
SPRINTF_RE = re.compile(r"\b(?:sprintf|str_replace|str_ireplace)\s*\(")


def first_arg_span(text: str, call_end: int) -> "tuple[int, int] | None":
    """Return (start, end) offsets of the first argument up to ',' or ')' at depth 0."""
    depth = 1
    i = call_end
    start = i
    in_str = None
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
        else:
            if ch in ('"', "'", "`"):
                in_str = ch
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    return (start, i)
            elif ch == "," and depth == 1:
                return (start, i)
        i += 1
    return None


def is_unsafe_first_arg(arg: str):
    """Return a short reason string when the arg is unsafe, else None."""
    if CONCAT_PHP_RE.search(arg):
        return "string concatenation with a variable"
    if INTERP_PHP_RE.search(arg):
        return "double-quoted string with variable interpolation"
    if TEMPLATE_TS_RE.search(arg):
        return "template literal with `${...}` interpolation"
    if CONCAT_TS_RE.search(arg):
        return "string concatenation with `+` and a variable"
    if SPRINTF_RE.search(arg):
        return "sprintf/str_replace used to build SQL"
    return None
