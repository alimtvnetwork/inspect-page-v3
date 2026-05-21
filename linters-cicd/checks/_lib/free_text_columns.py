"""Shared helpers for the free-text-column rule family (Rules 10/11/12).

Used by both:
* ``checks/free-text-columns/sql.py`` — DB-FREETEXT-001 (presence only)
* ``checks/missing-desc/sql.py``      — MISSING-DESC-001 (presence + nullability + waivers)

Splitting the logic here keeps the two rules in lockstep on
classification, scope, join-table detection, and column lookup so they
can never drift apart on those concerns.

Spec: spec/04-database-conventions/02-schema-design.md §6 (v3.4.0)
Naming: spec/04-database-conventions/01-naming-conventions.md Rules 10/11/12
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable


EXTENSIONS = (".sql",)
MIGRATION_HINTS = ("migrations", "migration")
RESERVED_COLUMNS = ("Description", "Notes", "Comments")

CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"
    r"(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?P<body>.*?)\)\s*;",
    re.IGNORECASE | re.DOTALL,
)

TRANSACTIONAL_SUFFIXES = (
    "Transaction", "Invoice", "Order", "Payment", "Bill",
    "Charge", "Refund", "Settlement",
)
AUDIT_SUFFIXES = ("Log", "History", "Event", "AuditLog")
LOOKUP_SUFFIXES = ("Type", "Status", "Role", "Category", "Kind")


def classify(table_name: str) -> str:
    """Return one of: transactional | audit | entity_or_lookup."""
    if any(table_name.endswith(s) for s in TRANSACTIONAL_SUFFIXES):
        return "transactional"
    if any(table_name.endswith(s) for s in AUDIT_SUFFIXES):
        return "audit"
    if any(table_name.endswith(s) for s in LOOKUP_SUFFIXES):
        return "entity_or_lookup"
    return "entity_or_lookup"


def required_columns(category: str) -> tuple[str, ...]:
    if category == "transactional":
        return ("Notes", "Comments")
    if category == "audit":
        return ("Notes",)
    return ("Description",)


def label_for(category: str) -> str:
    if category == "transactional":
        return "Transactional"
    if category == "audit":
        return "Audit/log"
    return "Entity/reference"


def looks_like_join_table(table_name: str, body: str) -> bool:
    """Heuristic: no '{TableName}Id ... PRIMARY KEY' column → likely junction."""
    pk_re = re.compile(
        rf"\b{re.escape(table_name)}Id\b[^,]*PRIMARY\s+KEY",
        re.IGNORECASE,
    )
    return pk_re.search(body) is None


def find_column_line(body: str, column: str) -> str | None:
    """Return the column declaration line for a reserved column, or None."""
    for raw in body.splitlines():
        stripped = raw.lstrip()
        if re.match(rf"{re.escape(column)}\b", stripped):
            return stripped
    return None


def is_in_scope(path: Path) -> bool:
    if path.suffix.lower() in EXTENSIONS:
        return True
    parts = {p.lower() for p in path.parts}
    return any(h in parts for h in MIGRATION_HINTS) and path.suffix.lower() == ".sql"


# ── Waiver support (used only when caller passes a rule_id) ───────────────

def file_waiver_re(rule_id: str) -> re.Pattern[str]:
    return re.compile(
        rf"--\s*linter-waive-file:\s*{re.escape(rule_id)}\b[^\n]*reason\s*=\s*\"[^\"]+\"",
        re.IGNORECASE,
    )


def block_waiver_re(rule_id: str) -> re.Pattern[str]:
    return re.compile(
        rf"--\s*linter-waive:\s*{re.escape(rule_id)}\b[^\n]*reason\s*=\s*\"[^\"]+\"",
        re.IGNORECASE,
    )


def is_block_waived(text: str, block_start: int, waiver_re: re.Pattern[str]) -> bool:
    """Block-level waiver lookback (5 non-blank comment-only lines)."""
    preceding = text[:block_start].splitlines()
    checked = 0
    for raw in reversed(preceding):
        stripped = raw.strip()
        if not stripped:
            continue
        if waiver_re.search(stripped):
            return True
        if not stripped.startswith("--"):
            return False
        checked += 1
        if checked >= 5:
            return False
    return False


# ── Generic finding shape (caller maps to its own SARIF Finding) ──────────

@dataclass(frozen=True)
class FreeTextFinding:
    table: str
    line: int
    category: str
    kind: str          # "missing" | "nullability"
    column: str
    message: str


def scan_text(
    text: str,
    *,
    check_nullability: bool,
    rule_id_for_waivers: str | None = None,
) -> list[FreeTextFinding]:
    """Walk every CREATE TABLE in *text* and return findings.

    Args:
        text: full SQL or markdown-extracted SQL content.
        check_nullability: also flag Rule 12 (NOT NULL / DEFAULT) violations.
        rule_id_for_waivers: when set, honour ``-- linter-waive`` and
            ``-- linter-waive-file`` comments scoped to that rule ID.
            When ``None``, waivers are ignored (DB-FREETEXT-001 keeps its
            original behaviour for backwards compatibility with existing
            CI configs that rely on no-waiver mode).
    """
    findings: list[FreeTextFinding] = []
    block_re = waiver_file_match = None
    if rule_id_for_waivers:
        if file_waiver_re(rule_id_for_waivers).search(text):
            return []
        block_re = block_waiver_re(rule_id_for_waivers)

    for block in CREATE_TABLE_RE.finditer(text):
        if block_re is not None and is_block_waived(text, block.start(), block_re):
            continue
        table = block.group("name")
        body = block.group("body")
        if looks_like_join_table(table, body):
            continue
        category = classify(table)
        line = text.count("\n", 0, block.start()) + 1
        rule_num = "11" if category != "entity_or_lookup" else "10"

        # Presence (Rules 10 / 11)
        for col in required_columns(category):
            if find_column_line(body, col) is None:
                findings.append(FreeTextFinding(
                    table=table, line=line, category=category,
                    kind="missing", column=col,
                    message=(
                        f"{label_for(category)} table '{table}' is missing required "
                        f"nullable column '{col} TEXT NULL' "
                        f"(Rule {rule_num} — see §6 of 02-schema-design.md)."
                    ),
                ))

        # Nullability (Rule 12)
        if check_nullability:
            for col in RESERVED_COLUMNS:
                col_line = find_column_line(body, col)
                if col_line is None:
                    continue
                upper = col_line.upper()
                if "NOT NULL" in upper or re.search(r"\bDEFAULT\b", upper):
                    findings.append(FreeTextFinding(
                        table=table, line=line, category=category,
                        kind="nullability", column=col,
                        message=(
                            f"Reserved free-text column '{col}' on table '{table}' "
                            f"violates Rule 12: must be nullable with no DEFAULT. "
                            f"Found: '{col_line.rstrip(',').strip()}'."
                        ),
                    ))
    return findings
