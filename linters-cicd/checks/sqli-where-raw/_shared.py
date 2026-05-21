"""Shared regex helpers for SQLI-RAW-002 (whereRaw without strict params)."""
from __future__ import annotations

import re

WHERE_RAW_CALL_RE = re.compile(
    r"\b(?:->|::)whereRaw\s*\(",
)

# A "strict" placeholder is exclusively `?` or `:name`. Anything else
# (variable interpolation, concatenation, sprintf, bare identifiers
# spliced in) is unsafe.
PLACEHOLDER_RE = re.compile(r"(\?|:[A-Za-z_]\w*)")
INTERP_PHP_RE = re.compile(r'"[^"]*\$[A-Za-z_]\w*[^"]*"')
TEMPLATE_TS_RE = re.compile(r"`[^`]*\$\{[^}]+\}[^`]*`")
CONCAT_PHP_RE = re.compile(r'"[^"\n]*"\s*\.\s*\$|\$[A-Za-z_]\w*\s*\.\s*"')
CONCAT_TS_RE = re.compile(r'''(["'])[^"'\n]*\1\s*\+\s*[A-Za-z_$]''')


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


def diagnose_where_raw(arg: str):
    """Return (reason, level) when arg is unsafe, else (None, None).

    error  — clear injection vector (interpolation, concatenation).
    warning — looks like a literal but contains no placeholders, suggesting
              the developer is splicing identifiers or constants without
              binding (still risky if any value is dynamic).
    """
    if INTERP_PHP_RE.search(arg) or TEMPLATE_TS_RE.search(arg):
        return ("contains string interpolation — bind values via params", "error")
    if CONCAT_PHP_RE.search(arg) or CONCAT_TS_RE.search(arg):
        return ("uses string concatenation with a variable — bind via params", "error")
    # If the arg is a single string literal but has zero placeholders AND
    # the call site clearly passes a non-empty params array, that's fine.
    # Detecting that requires the second arg, which the caller handles.
    return (None, None)


def has_placeholders(arg: str) -> bool:
    return bool(PLACEHOLDER_RE.search(arg))


def second_arg_present(text: str, end_of_first: int) -> bool:
    """Quick check: is there a non-empty second arg before the close paren?"""
    if end_of_first >= len(text) or text[end_of_first] != ",":
        return False
    rest = text[end_of_first + 1:]
    # find matching close paren at depth 0
    depth = 1
    buf = []
    in_str = None
    for ch in rest:
        if in_str:
            buf.append(ch)
            if ch == in_str:
                in_str = None
            continue
        if ch in ('"', "'", "`"):
            in_str = ch
            buf.append(ch)
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                break
        buf.append(ch)
    second = "".join(buf).strip()
    if not second:
        return False
    # empty array literals don't count as "present"
    if second in ("[]", "array()", "[ ]"):
        return False
    return True
