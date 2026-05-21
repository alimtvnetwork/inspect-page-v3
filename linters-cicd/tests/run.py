#!/usr/bin/env python3
"""Stdlib test runner for linters-cicd unit tests.

Discovers every `test_*.py` under `linters-cicd/tests/` and runs them
with verbose output. Exits 0 on success, 1 on any failure or error.

Usage:
    python3 linters-cicd/tests/run.py

Wired into `package.json` as `npm run test:linters` and into
`.github/workflows/ci.yml`.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

# Make `checks/...` and `tests/...` importable as top-level modules.
sys.path.insert(0, str(ROOT))


def main() -> int:
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=str(HERE), pattern="test_*.py", top_level_dir=str(ROOT))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
