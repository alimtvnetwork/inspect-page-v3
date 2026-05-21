#!/usr/bin/env python3
"""Tests for SQLI-RAW-001, SQLI-RAW-002, and SQLI-ORDER-001."""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load(mod_name: str, path: Path):
    spec = importlib.util.spec_from_file_location(mod_name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    return mod


_raw = _load("sqli_raw_shared", ROOT / "checks" / "sqli-raw-execute" / "_shared.py")
_where = _load("sqli_where_shared", ROOT / "checks" / "sqli-where-raw" / "_shared.py")
_order = _load("sqli_order_shared", ROOT / "checks" / "sqli-order-group-by" / "_shared.py")

raw_unsafe = _raw.is_unsafe_first_arg
diagnose_where_raw = _where.diagnose_where_raw
has_placeholders = _where.has_placeholders
second_arg_present = _where.second_arg_present
is_safe_identifier_arg = _order.is_safe_identifier_arg


class TestRawExecuteUnsafeArg(unittest.TestCase):
    def test_php_concatenation_flagged(self) -> None:
        self.assertIsNotNone(raw_unsafe('"SELECT * FROM x WHERE id=" . $id'))

    def test_php_interpolation_flagged(self) -> None:
        self.assertIsNotNone(raw_unsafe('"SELECT * FROM x WHERE id=$id"'))

    def test_ts_template_literal_flagged(self) -> None:
        self.assertIsNotNone(raw_unsafe('`SELECT * FROM x WHERE id=${id}`'))

    def test_ts_concat_flagged(self) -> None:
        self.assertIsNotNone(raw_unsafe('"SELECT * FROM x WHERE id=" + id'))

    def test_sprintf_flagged(self) -> None:
        self.assertIsNotNone(raw_unsafe('sprintf("SELECT * FROM %s", $t)'))

    def test_safe_literal_passes(self) -> None:
        self.assertIsNone(raw_unsafe('"SELECT * FROM x WHERE id = :id"'))
        self.assertIsNone(raw_unsafe("'SELECT * FROM x WHERE id = ?'"))


class TestWhereRawDiagnosis(unittest.TestCase):
    def test_interp_is_error(self) -> None:
        reason, level = diagnose_where_raw('"status = $status"')
        self.assertEqual(level, "error")
        self.assertIn("interpolation", reason)

    def test_concat_is_error(self) -> None:
        reason, level = diagnose_where_raw('"status = " . $status')
        self.assertEqual(level, "error")

    def test_placeholder_literal_is_clean(self) -> None:
        reason, _ = diagnose_where_raw("'status = :status'")
        self.assertIsNone(reason)

    def test_has_placeholders_detection(self) -> None:
        self.assertTrue(has_placeholders("'a = ? and b = :name'"))
        self.assertFalse(has_placeholders("'a = b'"))

    def test_second_arg_detection(self) -> None:
        self.assertTrue(second_arg_present(", [$x])", 0))
        self.assertFalse(second_arg_present(")", 0))
        self.assertFalse(second_arg_present(", [])", 0))


class TestOrderByIdentifierSafety(unittest.TestCase):
    def test_string_literal_safe(self) -> None:
        for arg in ("'CreatedAt'", '"CreatedAt"', "`CreatedAt`", "'users.id'"):
            with self.subTest(arg=arg):
                self.assertTrue(is_safe_identifier_arg(arg))

    def test_allowlist_lookup_safe(self) -> None:
        self.assertTrue(is_safe_identifier_arg("ALLOWED_COLUMNS['sort']"))
        self.assertTrue(is_safe_identifier_arg("$allowed[$key]"))
        self.assertTrue(is_safe_identifier_arg("COLS.createdAt"))

    def test_bare_variable_unsafe(self) -> None:
        for arg in ("$_GET['sort']", "req.query.sort", "$sort", "userInput"):
            with self.subTest(arg=arg):
                self.assertFalse(is_safe_identifier_arg(arg))

    def test_concat_unsafe(self) -> None:
        self.assertFalse(is_safe_identifier_arg('"users." . $col'))


class TestEndToEndPHPFixture(unittest.TestCase):
    """Run each php.py against a tiny fixture and check exit codes."""

    def _run(self, check_path: Path, source: str) -> int:
        import subprocess
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "demo.php").write_text(source, encoding="utf-8")
            out = Path(td) / "out.sarif"
            return subprocess.call([
                sys.executable, str(check_path),
                "--path", td, "--format", "sarif", "--output", str(out),
            ])

    def test_raw_execute_flags_concat(self) -> None:
        check = ROOT / "checks" / "sqli-raw-execute" / "php.py"
        rc = self._run(check, '<?php $r = Orm::rawExecute("SELECT * FROM x WHERE id=" . $id);')
        self.assertEqual(rc, 1)

    def test_where_raw_flags_interp(self) -> None:
        check = ROOT / "checks" / "sqli-where-raw" / "php.py"
        rc = self._run(check, '<?php $q->whereRaw("status = $status");')
        self.assertEqual(rc, 1)

    def test_order_by_flags_variable(self) -> None:
        check = ROOT / "checks" / "sqli-order-group-by" / "php.py"
        rc = self._run(check, '<?php $q->orderBy($_GET["sort"], "asc");')
        self.assertEqual(rc, 1)

    def test_clean_code_passes(self) -> None:
        clean = (
            "<?php\n"
            "$rows = Orm::rawExecute('SELECT * FROM x WHERE id = :id', [':id' => $id]);\n"
            "$q->whereRaw('status = ?', [$status]);\n"
            "$q->orderBy('CreatedAt', 'desc');\n"
        )
        for sub in ("sqli-raw-execute", "sqli-where-raw", "sqli-order-group-by"):
            with self.subTest(sub=sub):
                rc = self._run(ROOT / "checks" / sub / "php.py", clean)
                self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
