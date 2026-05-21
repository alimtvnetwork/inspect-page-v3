#!/usr/bin/env python3
"""Unit tests for BOOL-NEG-001 — boolean-column-negative SQL check.

Stdlib-only (unittest). No pytest dependency. Run with:

    python3 -m unittest linters-cicd.tests.test_boolean_column_negative -v

Or via the suite runner:

    python3 linters-cicd/tests/run.py

Locks in the behavior verified end-to-end by `run-all.sh` in v4.11.0
(closes pending-issue #01) so future regex extensions (task #07) cannot
silently regress the v1 contract.

Spec:
- spec/04-database-conventions/01-naming-conventions.md  Rules 2 & 9
- linters-cicd/checks/boolean-column-negative/sql.py
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

# Make `checks/...` importable without installing the linters package.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from checks.boolean_column_negative_shim import scan_text  # noqa: E402


class TestForbiddenPrefixes(unittest.TestCase):
    """Every Is/Has + Not/No combination must be flagged."""

    def test_is_not_active_flagged(self) -> None:
        findings = scan_text(_create_table("Account", ["IsNotActive BOOLEAN NOT NULL"]))
        self._assert_flagged(findings, ["IsNotActive"])

    def test_has_no_access_flagged(self) -> None:
        findings = scan_text(_create_table("User", ["HasNoAccess BOOLEAN NOT NULL"]))
        self._assert_flagged(findings, ["HasNoAccess"])

    def test_is_no_license_flagged(self) -> None:
        findings = scan_text(_create_table("License", ["IsNoLicense BOOLEAN NOT NULL"]))
        self._assert_flagged(findings, ["IsNoLicense"])

    def test_has_not_verified_flagged(self) -> None:
        findings = scan_text(_create_table("Email", ["HasNotVerified BOOLEAN NOT NULL"]))
        self._assert_flagged(findings, ["HasNotVerified"])

    def test_multiple_violations_in_one_table(self) -> None:
        findings = scan_text(_create_table("Account", [
            "IsNotActive BOOLEAN NOT NULL",
            "HasNoAccess BOOLEAN NOT NULL",
            "IsNotVerified BOOLEAN NOT NULL",
            "HasNoLicense BOOLEAN NOT NULL",
        ]))
        self._assert_flagged(findings, [
            "IsNotActive", "HasNoAccess", "IsNotVerified", "HasNoLicense",
        ])

    def _assert_flagged(self, findings: list, expected: list[str]) -> None:
        names = sorted(_extract_column_names(findings))
        self.assertEqual(names, sorted(expected),
                         f"Expected {expected} flagged, got {names}")


class TestAllowList(unittest.TestCase):
    """Approved single-negative roots must NEVER be flagged."""

    ALLOWED = [
        "IsDisabled", "IsInvalid", "IsIncomplete", "IsUnavailable",
        "IsUnread", "IsHidden", "IsBroken", "IsLocked",
        "IsUnpublished", "IsUnverified",
    ]

    def test_each_allowlisted_name_passes(self) -> None:
        for name in self.ALLOWED:
            with self.subTest(name=name):
                findings = scan_text(_create_table("T", [f"{name} BOOLEAN NOT NULL"]))
                self.assertEqual(findings, [],
                                 f"Allow-listed '{name}' should not be flagged")

    def test_full_allowlist_in_one_table_passes(self) -> None:
        cols = [f"{n} BOOLEAN NOT NULL" for n in self.ALLOWED]
        findings = scan_text(_create_table("T", cols))
        self.assertEqual(findings, [])


class TestPositiveForms(unittest.TestCase):
    """Positive-form columns are always clean."""

    POSITIVE = ["IsActive", "HasAccess", "IsVerified", "HasLicense", "IsEnabled"]

    def test_positive_columns_pass(self) -> None:
        for name in self.POSITIVE:
            with self.subTest(name=name):
                findings = scan_text(_create_table("T", [f"{name} BOOLEAN NOT NULL"]))
                self.assertEqual(findings, [])


class TestSuspectTier(unittest.TestCase):
    """v2 (Task #07) — Cannot/Dis/Un single-negative roots are now flagged
    at warning level (Tier 2). Approved single-negatives like IsDisabled
    stay on the allow-list and remain unflagged."""

    SUSPECT = ["CannotEdit", "DisabledFlag", "UnreadStatus"]

    def test_suspect_roots_flagged_as_warning(self) -> None:
        for name in self.SUSPECT:
            with self.subTest(name=name):
                findings = scan_text(_create_table("T", [f"{name} BOOLEAN NOT NULL"]))
                tiers = [f["tier"] for f in findings]
                self.assertEqual(
                    tiers, ["suspect"],
                    f"'{name}' should produce exactly one suspect-tier finding",
                )

    def test_allowlisted_disabled_still_clean(self) -> None:
        # The single literal "IsDisabled" is the approved positive form
        # and must NOT be flagged even though it matches the Dis* root.
        findings = scan_text(_create_table("T", ["IsDisabled BOOLEAN NOT NULL"]))
        self.assertEqual(findings, [])



class TestStructural(unittest.TestCase):
    """Structural edge cases: comments, multiple tables, no CREATE TABLE."""

    def test_findings_carry_correct_line_number(self) -> None:
        sql = "\n".join([
            "-- line 1 comment",
            "CREATE TABLE Account (",   # line 2
            "    AccountId INTEGER,",   # line 3
            "    IsNotActive BOOLEAN",  # line 4
            ");",
        ])
        findings = scan_text(sql)
        self.assertEqual(len(findings), 1)
        # CREATE TABLE block starts at line 2; finding line points at the block.
        self.assertGreaterEqual(findings[0]["line"], 2)
        self.assertLessEqual(findings[0]["line"], 4)

    def test_multiple_tables_independent(self) -> None:
        sql = (
            _create_table("A", ["IsNotActive BOOLEAN"])
            + "\n"
            + _create_table("B", ["IsActive BOOLEAN"])
        )
        findings = scan_text(sql)
        names = _extract_column_names(findings)
        self.assertEqual(sorted(names), ["IsNotActive"])

    def test_empty_file_produces_no_findings(self) -> None:
        self.assertEqual(scan_text(""), [])

    def test_file_without_create_table_produces_no_findings(self) -> None:
        sql = "SELECT IsNotActive FROM Account WHERE HasNoAccess = 1;"
        # Outside CREATE TABLE → out of scope by design.
        self.assertEqual(scan_text(sql), [])


def _create_table(name: str, columns: list[str]) -> str:
    body = ",\n    ".join(columns)
    return f"CREATE TABLE {name} (\n    {body}\n);\n"


def _extract_column_names(findings: list) -> list[str]:
    out = []
    for f in findings:
        # message format: "Boolean column 'XYZ' uses a forbidden..."
        msg = f["message"]
        if "'" in msg:
            out.append(msg.split("'")[1])
    return out


if __name__ == "__main__":
    unittest.main(verbosity=2)
