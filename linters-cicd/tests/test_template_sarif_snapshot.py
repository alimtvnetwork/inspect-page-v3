#!/usr/bin/env python3
"""SARIF snapshot tests for the `_template/` starter-kit rules.

Why these exist
---------------
The starter-kit rules (`checks/_template/php.py` today, plus any
sibling `<lang>.py` added later) are the canonical reference any new
rule is copied from. If their SARIF output silently drifts — a
renamed rule, a shifted line number, a reworded fix message — every
downstream consumer (CI dashboards, IDE plugins, audit logs) breaks
at once and we have no test that screams.

These snapshot tests pin:
  * tool driver `name` + `version`
  * rule metadata: `id`, `name`, `shortDescription`, `helpUri`
  * per-finding `ruleId`, `level`, `message`, `file_path`,
    `start_line`, `start_column`, in scan order

Snapshots live next to this file in `snapshots/` as plain JSON. See
`snapshots/README.md` for the format and the regen recipe.

Regenerating
------------
    UPDATE_SNAPSHOTS=1 python3 linters-cicd/tests/run.py

Review the diff before committing. Every changed byte is a public API
change for SARIF consumers.
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import unittest
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT_DIR = Path(__file__).resolve().parent / "snapshots"
UPDATE = os.environ.get("UPDATE_SNAPSHOTS") == "1"


@dataclass(frozen=True)
class SnapshotCase:
    """One (check script, fixture file) pair pinned to one snapshot."""

    label: str
    script: Path        # e.g. checks/_template/php.py
    fixture: Path       # e.g. checks/_template/fixtures/dirty.php
    snapshot: Path      # e.g. tests/snapshots/template_php_dirty.json


# Add a new tuple here when you add a sibling-language template
# (e.g. checks/_template/typescript.py + fixtures/dirty.ts).
SNAPSHOT_CASES: tuple[SnapshotCase, ...] = (
    SnapshotCase(
        label="template_php_dirty",
        script=ROOT / "checks" / "_template" / "php.py",
        fixture=ROOT / "checks" / "_template" / "fixtures" / "dirty.php",
        snapshot=SNAPSHOT_DIR / "template_php_dirty.json",
    ),
)


def _load_check(script: Path):
    """Import a check module by file path under a unique module name."""
    mod_name = f"_snapshot_check_{script.parent.name}_{script.stem}"
    spec = importlib.util.spec_from_file_location(mod_name, script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import check script: {script}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    if not hasattr(mod, "RULE") or not hasattr(mod, "scan"):
        raise AttributeError(
            f"{script} must expose RULE and scan() to be snapshot-testable"
        )
    return mod


def _project_findings(findings: Iterable) -> list[dict]:
    return [
        {
            "rule_id": f.rule_id,
            "level": f.level,
            "message": f.message,
            "file_path": f.file_path,
            "start_line": f.start_line,
            "start_column": f.start_column,
        }
        for f in findings
    ]


def _project_rule(rule) -> dict:
    return {
        "id": rule.id,
        "name": rule.name,
        "short_description": rule.short_description,
        "help_uri_relative": rule.help_uri_relative,
    }


def _build_snapshot(case: SnapshotCase) -> dict:
    mod = _load_check(case.script)
    fixture_dir = case.fixture.parent
    findings = mod.scan(case.fixture, str(fixture_dir))
    # Discover the tool name + version the same way main() does, but
    # without invoking argparse/CLI side effects. We read them from
    # the constructor call literally embedded in main().
    tool_name, tool_version = _extract_tool_identity(case.script)
    return {
        "tool": {"name": tool_name, "version": tool_version},
        "rules": [_project_rule(mod.RULE)],
        "results": _project_findings(findings),
    }


def _extract_tool_identity(script: Path) -> tuple[str, str]:
    """Parse `tool_name=` and `tool_version=` from the SarifRun(...) call.

    Snapshot tests must not run the check's main() (which would parse
    sys.argv and write to stdout). The tool identity is therefore
    extracted statically from the source — a simple, deterministic
    string scan that matches the boilerplate pattern every check uses.
    """
    src = script.read_text(encoding="utf-8")
    name = _grab(src, "tool_name=")
    version = _grab(src, "tool_version=")
    if name is None or version is None:
        raise AssertionError(
            f"{script}: SarifRun(tool_name=..., tool_version=...) "
            f"not found — snapshot test cannot extract tool identity"
        )
    return name, version


def _grab(src: str, marker: str) -> str | None:
    idx = src.find(marker)
    if idx < 0:
        return None
    rest = src[idx + len(marker):].lstrip()
    if not rest or rest[0] not in ("'", '"'):
        return None
    quote = rest[0]
    end = rest.find(quote, 1)
    if end < 0:
        return None
    return rest[1:end]


def _normalize(payload: dict) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n"


class TestTemplateSarifSnapshot(unittest.TestCase):
    """One snapshot assertion per (script, fixture) tuple."""

    def test_snapshot_cases_are_unique(self) -> None:
        labels = [c.label for c in SNAPSHOT_CASES]
        self.assertEqual(len(labels), len(set(labels)),
                         "SNAPSHOT_CASES labels must be unique")

    def test_every_snapshot_file_is_referenced(self) -> None:
        """Guard against orphaned snapshot files (renamed/deleted cases)."""
        referenced = {c.snapshot.resolve() for c in SNAPSHOT_CASES}
        on_disk = {p.resolve() for p in SNAPSHOT_DIR.glob("*.json")}
        orphans = sorted(p.name for p in (on_disk - referenced))
        self.assertEqual(
            orphans, [],
            f"Orphaned snapshot files: {orphans}. "
            f"Delete them or add a SnapshotCase that references them."
        )

    def test_snapshots_match(self) -> None:
        for case in SNAPSHOT_CASES:
            with self.subTest(label=case.label):
                actual = _build_snapshot(case)
                actual_text = _normalize(actual)

                if UPDATE:
                    case.snapshot.parent.mkdir(parents=True, exist_ok=True)
                    case.snapshot.write_text(actual_text, encoding="utf-8")
                    continue

                self.assertTrue(
                    case.snapshot.exists(),
                    f"Missing snapshot: {case.snapshot}. "
                    f"Run UPDATE_SNAPSHOTS=1 python3 "
                    f"linters-cicd/tests/run.py to create it."
                )
                expected_text = case.snapshot.read_text(encoding="utf-8")
                self.assertEqual(
                    json.loads(actual_text),
                    json.loads(expected_text),
                    f"Snapshot drift for {case.label}. "
                    f"If intentional, regenerate with "
                    f"UPDATE_SNAPSHOTS=1 python3 linters-cicd/tests/run.py"
                )


if __name__ == "__main__":
    unittest.main()