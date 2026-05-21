"""Test load-config.py emits EXCLUDE_PATHS from TOML and CLI flag (B9)."""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LOAD_CONFIG = REPO_ROOT / "linters-cicd" / "scripts" / "load-config.py"


def _run(args: list[str]) -> dict[str, str]:
    result = subprocess.run(
        ["python3", str(LOAD_CONFIG), *args],
        capture_output=True,
        text=True,
        check=True,
    )
    out: dict[str, str] = {}
    for line in result.stdout.strip().splitlines():
        k, _, v = line.partition("=")
        out[k] = v
    return out


class TestLoadConfigExcludePaths(unittest.TestCase):
    def test_default_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cfg = Path(tmp) / "missing.toml"
            out = _run(["--config", str(cfg)])
            self.assertEqual(out["EXCLUDE_PATHS"], "")

    def test_toml_value_picked_up(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cfg = Path(tmp) / ".codeguidelines.toml"
            cfg.write_text(
                "[run]\nexclude-paths = ['vendor/**', '**/*.gen.go']\n",
                encoding="utf-8",
            )
            out = _run(["--config", str(cfg)])
            self.assertEqual(out["EXCLUDE_PATHS"], "vendor/**,**/*.gen.go")

    def test_cli_overrides_toml(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cfg = Path(tmp) / ".codeguidelines.toml"
            cfg.write_text(
                "[run]\nexclude-paths = ['vendor/**']\n", encoding="utf-8"
            )
            out = _run(
                ["--config", str(cfg), "--exclude-paths", "build/**,dist/**"]
            )
            self.assertEqual(out["EXCLUDE_PATHS"], "build/**,dist/**")


if __name__ == "__main__":
    unittest.main()
