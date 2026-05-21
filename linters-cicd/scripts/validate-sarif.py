#!/usr/bin/env python3
"""Validate every emitted SARIF file against the SARIF 2.1.0 schema (basic shape)."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_TOP = {"$schema", "version", "runs"}
REQUIRED_RUN = {"tool", "results"}
REQUIRED_RESULT = {"ruleId", "level", "message", "locations"}


def validate(path: str) -> list[str]:
    errors: list[str] = []
    doc = json.loads(Path(path).read_text())
    missing = REQUIRED_TOP - doc.keys()
    if missing:
        errors.append(f"top-level missing: {missing}")
    if doc.get("version") != "2.1.0":
        errors.append(f"version must be 2.1.0, got {doc.get('version')}")
    for i, run in enumerate(doc.get("runs", [])):
        miss = REQUIRED_RUN - run.keys()
        if miss:
            errors.append(f"runs[{i}] missing: {miss}")
        for j, res in enumerate(run.get("results", [])):
            miss = REQUIRED_RESULT - res.keys()
            if miss:
                errors.append(f"runs[{i}].results[{j}] missing: {miss}")
    return errors


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: validate-sarif.py <file> [<file> ...]", file=sys.stderr)
        sys.exit(2)
    failed = 0
    for p in sys.argv[1:]:
        errs = validate(p)
        if errs:
            failed += 1
            print(f"❌ {p}")
            for e in errs:
                print(f"   {e}")
        else:
            print(f"✅ {p}")
    sys.exit(1 if failed else 0)
