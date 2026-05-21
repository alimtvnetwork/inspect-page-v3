#!/usr/bin/env python3
"""Unit tests for BOOL-NEG-001 (Go) — boolean-column-negative Go scanner.

Stdlib unittest. Run via `python3 linters-cicd/tests/run.py` or
`python3 -m unittest linters-cicd.tests.test_boolean_column_negative_go`.

Locks in the Go scanner contract (struct tags + embedded SQL) and
ensures lock-step parity with the SQL scanner's allow-list and
forbidden-prefix regex.

Spec:
- spec/04-database-conventions/01-naming-conventions.md  Rules 2 & 9
- linters-cicd/checks/boolean-column-negative/go.py
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from checks.boolean_column_negative_go_shim import (  # noqa: E402
    is_violation, scan_text, snake_to_pascal,
)


class TestSnakeToPascal(unittest.TestCase):
    def test_snake_converts(self) -> None:
        self.assertEqual(snake_to_pascal("is_not_active"), "IsNotActive")
        self.assertEqual(snake_to_pascal("has_no_access"), "HasNoAccess")

    def test_pascal_passes_through(self) -> None:
        self.assertEqual(snake_to_pascal("IsNotActive"), "IsNotActive")

    def test_lowercase_capitalises(self) -> None:
        self.assertEqual(snake_to_pascal("active"), "Active")

    def test_empty_safe(self) -> None:
        self.assertEqual(snake_to_pascal(""), "")


class TestStructFieldName(unittest.TestCase):
    """Struct field name alone (no tag) is checked — covers GORM defaults."""

    def test_bool_field_with_forbidden_name_flagged(self) -> None:
        src = (
            "type Account struct {\n"
            "    AccountID    int64\n"
            "    IsNotActive  bool\n"
            "}\n"
        )
        findings = scan_text(src)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["column"], "IsNotActive")
        self.assertEqual(findings[0]["kind"], "struct-field")

    def test_non_bool_field_ignored(self) -> None:
        src = (
            "type Account struct {\n"
            "    IsNotActive  string\n"   # not bool — ignored
            "}\n"
        )
        self.assertEqual(scan_text(src), [])

    def test_pointer_bool_also_flagged(self) -> None:
        src = (
            "type Account struct {\n"
            "    HasNoAccess  *bool\n"
            "}\n"
        )
        findings = scan_text(src)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["column"], "HasNoAccess")


class TestDbTag(unittest.TestCase):
    """`db:""` (sqlx) tag takes priority over field name."""

    def test_db_tag_with_forbidden_snake_case_flagged(self) -> None:
        src = (
            "type Account struct {\n"
            "    Active bool `db:\"is_not_active\"`\n"
            "}\n"
        )
        findings = scan_text(src)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["column"], "IsNotActive")
        self.assertEqual(findings[0]["kind"], "db-tag")

    def test_db_tag_with_clean_column_passes_even_with_dirty_field(self) -> None:
        # Field name would be flagged on its own, but explicit db tag wins.
        src = (
            "type Account struct {\n"
            "    IsNotActive bool `db:\"is_active\"`\n"
            "}\n"
        )
        self.assertEqual(scan_text(src), [])


class TestGormColumnTag(unittest.TestCase):
    """`gorm:"column:..."` tag takes priority over field name and db tag."""

    def test_gorm_column_with_forbidden_name_flagged(self) -> None:
        src = (
            "type Account struct {\n"
            "    Active bool `gorm:\"column:has_no_access;not null\"`\n"
            "}\n"
        )
        findings = scan_text(src)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0]["column"], "HasNoAccess")
        self.assertEqual(findings[0]["kind"], "gorm-tag")

    def test_gorm_column_clean_passes(self) -> None:
        src = (
            "type Account struct {\n"
            "    Active bool `gorm:\"column:is_active;not null\"`\n"
            "}\n"
        )
        self.assertEqual(scan_text(src), [])


class TestAllowListLockstep(unittest.TestCase):
    """Allow-list MUST match sql.py exactly — verified case-by-case."""

    ALLOWED = [
        "IsDisabled", "IsInvalid", "IsIncomplete", "IsUnavailable",
        "IsUnread", "IsHidden", "IsBroken", "IsLocked",
        "IsUnpublished", "IsUnverified",
    ]

    def test_each_allowed_field_passes(self) -> None:
        for name in self.ALLOWED:
            with self.subTest(name=name):
                src = f"type T struct {{\n    {name} bool\n}}\n"
                self.assertEqual(scan_text(src), [],
                                 f"Allow-listed '{name}' must not be flagged")

    def test_each_allowed_passes_via_is_violation(self) -> None:
        for name in self.ALLOWED:
            with self.subTest(name=name):
                self.assertFalse(is_violation(name))


class TestEmbeddedSQL(unittest.TestCase):
    """Back-tick raw strings holding CREATE TABLE are scanned as SQL."""

    def test_embedded_create_table_flagged(self) -> None:
        src = (
            "package migrations\n\n"
            "const Schema = `\n"
            "CREATE TABLE Account (\n"
            "    AccountId INTEGER PRIMARY KEY,\n"
            "    IsNotActive BOOLEAN NOT NULL,\n"
            "    HasNoAccess BOOLEAN NOT NULL\n"
            ");\n"
            "`\n"
        )
        findings = scan_text(src)
        cols = sorted(f["column"] for f in findings)
        self.assertEqual(cols, ["HasNoAccess", "IsNotActive"])
        for f in findings:
            self.assertEqual(f["kind"], "embedded-sql")

    def test_embedded_sql_allowlist_respected(self) -> None:
        src = (
            "const Schema = `\n"
            "CREATE TABLE T (\n"
            "    IsDisabled BOOLEAN NOT NULL,\n"
            "    IsUnverified BOOLEAN NOT NULL\n"
            ");\n"
            "`\n"
        )
        self.assertEqual(scan_text(src), [])


class TestMixedSources(unittest.TestCase):
    """Struct tags + embedded SQL findings should both surface in one pass."""

    def test_struct_and_embedded_sql_combined(self) -> None:
        src = (
            "type Account struct {\n"
            "    Active bool `db:\"is_not_active\"`\n"
            "}\n\n"
            "const Schema = `CREATE TABLE T (HasNoLicense BOOLEAN NOT NULL);`\n"
        )
        findings = scan_text(src)
        kinds = sorted(f["kind"] for f in findings)
        cols = sorted(f["column"] for f in findings)
        self.assertEqual(kinds, ["db-tag", "embedded-sql"])
        self.assertEqual(cols, ["HasNoLicense", "IsNotActive"])


class TestSuspectTier(unittest.TestCase):
    """v2 (Task #07) — Cannot/Disabled/Un* roots are flagged at suspect
    tier in Go via struct-tag detection.

    Uses the v2 ``scan_struct_tags_v2`` walker so we can inspect the tier;
    the v1 ``scan_text`` shim only surfaces forbidden-tier findings.
    """

    def _v2_struct_findings(self, src: str) -> list[tuple[str, int, str, str]]:
        import sys
        from pathlib import Path
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "checks"))
        from boolean_column_negative_go_shim import _mod  # noqa: E402
        return _mod.scan_struct_tags_v2(src)

    def test_cannot_prefix_flagged_as_suspect(self) -> None:
        src = "type T struct {\n    CannotEdit bool\n}\n"
        findings = self._v2_struct_findings(src)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0][3], "suspect")

    def test_disabled_flag_flagged_as_suspect(self) -> None:
        src = "type T struct {\n    DisabledFlag bool\n}\n"
        findings = self._v2_struct_findings(src)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0][3], "suspect")

    def test_allowlisted_isdisabled_stays_clean(self) -> None:
        src = "type T struct {\n    IsDisabled bool\n}\n"
        findings = self._v2_struct_findings(src)
        self.assertEqual(findings, [])



if __name__ == "__main__":
    unittest.main(verbosity=2)
