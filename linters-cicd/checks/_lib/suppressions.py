"""Inline source-line suppression parser.

Spec: spec/02-coding-guidelines/06-cicd-integration/98-faq.md §1

Recognized syntax (in any single-line comment):
    codeguidelines:disable=RULE-ID[,RULE-ID...] — reason text
    codeguidelines:disable-next-line=RULE-ID[,...] — reason text

Rules:
- 'disable=' suppresses the line the comment sits on.
- 'disable-next-line=' suppresses the next non-blank line.
- A reason after an em dash (—) or '--' is REQUIRED. Reasonless
  suppressions are returned as InvalidSuppression so callers can
  emit STYLE-099 SuppressionWithoutReason findings instead of
  silently ignoring them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

# Require a real comment leader before the directive so docstrings
# and string literals don't accidentally match.
COMMENT_LEADER = r"(?://|#|/\*|\*|--|<!--)"
DISABLE_RE = re.compile(
    COMMENT_LEADER
    + r".*?codeguidelines:(disable(?:-next-line)?)=([A-Z0-9\-,]+)\s*(?:[—-]{1,2}\s*(.+?))?\s*(?:\*/|-->)?$"
)


@dataclass(frozen=True)
class Suppression:
    rule_ids: frozenset[str]
    target_line: int
    reason: str


@dataclass(frozen=True)
class InvalidSuppression:
    rule_ids: frozenset[str]
    comment_line: int
    raw: str


@dataclass(frozen=True)
class ParseResult:
    valid: list[Suppression]
    invalid: list[InvalidSuppression]


def parse_file(path: Path) -> list[Suppression]:
    """Backwards-compatible: return only valid suppressions."""
    return parse_file_full(path).valid


def parse_file_full(path: Path) -> ParseResult:
    """Return both valid and invalid suppressions found in path."""
    valid: list[Suppression] = []
    invalid: list[InvalidSuppression] = []
    lines = _read_lines(path)
    if not lines:
        return ParseResult(valid=valid, invalid=invalid)
    for idx, raw in enumerate(lines, start=1):
        match = DISABLE_RE.search(raw)
        if not match:
            continue
        _classify(match, idx, raw, lines, valid, invalid)
    return ParseResult(valid=valid, invalid=invalid)


def _read_lines(path: Path) -> list[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []


def _classify(
    match: re.Match,
    line_idx: int,
    raw: str,
    lines: list[str],
    valid: list[Suppression],
    invalid: list[InvalidSuppression],
) -> None:
    kind, ids_csv, reason = match.group(1), match.group(2), match.group(3)
    rule_ids = frozenset(r.strip() for r in ids_csv.split(",") if r.strip())
    if not _has_reason(reason):
        invalid.append(InvalidSuppression(rule_ids=rule_ids, comment_line=line_idx, raw=raw.strip()))
        return
    target = _resolve_target(kind, line_idx, lines)
    if target == 0:
        return
    valid.append(Suppression(rule_ids=rule_ids, target_line=target, reason=reason.strip()))


def _has_reason(reason: str | None) -> bool:
    return bool(reason and reason.strip())


def _resolve_target(kind: str, comment_line: int, lines: list[str]) -> int:
    if kind == "disable":
        return comment_line
    return _next_non_blank(lines, comment_line)


def _next_non_blank(lines: list[str], after_line: int) -> int:
    for idx in range(after_line, len(lines)):
        if lines[idx].strip():
            return idx + 1
    return 0


def is_suppressed(suppressions: list[Suppression], rule_id: str, line: int) -> bool:
    """True if rule_id at line is covered by any suppression in the list."""
    for s in suppressions:
        if s.target_line == line and rule_id in s.rule_ids:
            return True
    return False
