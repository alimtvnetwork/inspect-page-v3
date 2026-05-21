"""Shared helpers for SQLI-ORDER-001 (unvalidated orderBy/groupBy idents)."""
from __future__ import annotations

import re

# Match orderBy / orderByAsc / orderByDesc / groupBy on a chained builder
# via -> (PHP) or . (TS/JS). Static calls (Orm::orderBy) are also caught.
ORDER_GROUP_CALL_RE = re.compile(
    r"\b(?:->|\.|::)(?P<method>orderBy(?:Asc|Desc)?|groupBy)\s*\(",
)

# Acceptable first arg patterns:
#   - String literal:    'CreatedAt'  "CreatedAt"  `CreatedAt`
#   - Allow-list lookup: ALLOWED_COLUMNS['x']  $allowed['x']  COLS.x
# Everything else (bare variable, request input, concatenation, template
# interpolation) is unsafe because the ORM does not validate identifiers
# beyond a minimal `[A-Za-z0-9_]+` regex.
STRING_LITERAL_RE = re.compile(
    r"""^\s*(?:'[A-Za-z_][A-Za-z0-9_.]*'|"[A-Za-z_][A-Za-z0-9_.]*"|`[A-Za-z_][A-Za-z0-9_.]*`)\s*$"""
)
# Allow-list lookups must be ALL-CAPS constants (PHP/TS) or
# variables whose name explicitly contains "allow" / "whitelist".
# Anything else (including superglobals like $_GET) is rejected.
ALLOWLIST_LOOKUP_RE = re.compile(
    r"""^\s*(?:[A-Z][A-Z0-9_]*|\$(?:allow|whitelist)[A-Za-z0-9_]*)\s*\[[^\]]+\]\s*$""",
    re.IGNORECASE,
)
ALLOWLIST_PROP_RE = re.compile(
    r"""^\s*[A-Z][A-Z0-9_]*\.[A-Za-z_]\w*\s*$"""
)

# Hard-block superglobals and common request handles even if they
# happen to look like allow-list patterns.
TAINTED_PREFIXES = (
    "$_get", "$_post", "$_request", "$_cookie", "$_server", "$_files",
    "req.query", "req.body", "req.params", "request.query",
    "request.body", "request.params", "ctx.query", "ctx.params",
)


def first_arg_span(text: str, call_end: int):
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


def is_safe_identifier_arg(arg: str) -> bool:
    arg = arg.strip()
    if not arg:
        return False
    low = arg.lower()
    for prefix in TAINTED_PREFIXES:
        if low.startswith(prefix):
            return False
    if STRING_LITERAL_RE.match(arg):
        return True
    if ALLOWLIST_LOOKUP_RE.match(arg):
        return True
    if ALLOWLIST_PROP_RE.match(arg):
        return True
    return False
