#!/usr/bin/env python3
"""Tests for the codegen determinism harness (Task #05).

Black-box tests around ``linters-cicd/codegen/scripts/verify-codegen-determinism.sh``:

1. **Happy path** — committed expected/ matches a fresh codegen run; verify exits 0.
2. **Drift detection** — mutating a fixture or an expected/ file makes the
   verify script exit non-zero. Proves CI will actually catch silent changes
   to either the inversion table, an emitter, or a parser.
3. **Regen idempotency** — running regen twice produces byte-identical files
   the second time (no timestamps, no random ordering leaking into output).

Run via ``python3 linters-cicd/tests/run.py``.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CODEGEN_DIR = ROOT / "linters-cicd" / "codegen"
VERIFY = CODEGEN_DIR / "scripts" / "verify-codegen-determinism.sh"
REGEN = CODEGEN_DIR / "scripts" / "regen-codegen-fixtures.sh"
EXPECTED_DIR = CODEGEN_DIR / "fixtures" / "expected"


def run_verify() -> subprocess.CompletedProcess:
    return subprocess.run(
        ["bash", str(VERIFY)],
        capture_output=True, text=True, cwd=ROOT,
    )


class TestHappyPath(unittest.TestCase):
    def test_committed_fixtures_pass_verify(self) -> None:
        result = run_verify()
        self.assertEqual(
            result.returncode, 0,
            f"verify failed unexpectedly:\nstdout:\n{result.stdout}\n"
            f"stderr:\n{result.stderr}",
        )
        self.assertIn("determinism verified", result.stdout)


class TestDriftDetection(unittest.TestCase):
    """Mutating an expected/ file MUST make verify fail."""

    def setUp(self) -> None:
        # Snapshot every expected file so we can restore in tearDown
        # even if the test crashes mid-mutation.
        self._backups: dict[Path, str] = {}
        for f in EXPECTED_DIR.iterdir():
            if f.is_file():
                self._backups[f] = f.read_text(encoding="utf-8")

    def tearDown(self) -> None:
        for path, original in self._backups.items():
            path.write_text(original, encoding="utf-8")

    def test_mutated_expected_go_fails(self) -> None:
        target = EXPECTED_DIR / "User.generated.go"
        target.write_text(
            target.read_text(encoding="utf-8") + "\n// drift\n",
            encoding="utf-8",
        )
        result = run_verify()
        self.assertNotEqual(result.returncode, 0,
                            "verify should fail when expected/ is mutated")
        self.assertIn("drift detected", result.stdout + result.stderr)

    def test_mutated_expected_php_fails(self) -> None:
        target = EXPECTED_DIR / "User.generated.php"
        target.write_text("// corrupted\n", encoding="utf-8")
        result = run_verify()
        self.assertNotEqual(result.returncode, 0)


class TestRegenIdempotency(unittest.TestCase):
    """Two consecutive regen calls must produce byte-identical files."""

    def test_regen_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            scratch_dir = Path(scratch)
            # Capture current expected/ as the "first regen" baseline.
            first = {f.name: f.read_text(encoding="utf-8")
                     for f in EXPECTED_DIR.iterdir() if f.is_file()}

            # Run regen again into the live expected/ dir; verify
            # nothing changed byte-for-byte.
            result = subprocess.run(
                ["bash", str(REGEN)],
                capture_output=True, text=True, cwd=ROOT,
            )
            self.assertEqual(result.returncode, 0,
                             f"regen failed:\n{result.stderr}")

            second = {f.name: f.read_text(encoding="utf-8")
                      for f in EXPECTED_DIR.iterdir() if f.is_file()}

            self.assertEqual(
                first, second,
                "regen produced different output on a second run — "
                "codegen is non-deterministic (timestamps? dict order?)",
            )
            # Suppress unused-variable lint on scratch_dir
            _ = scratch_dir


if __name__ == "__main__":
    unittest.main(verbosity=2)
