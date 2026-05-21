"""
SARIF 2.1.0 emitter — shared by every check script in linters-cicd/checks/.

Contract: see spec/02-coding-guidelines/06-cicd-integration/01-sarif-contract.md
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from typing import Iterable, Literal


SCHEMA_URL = "https://json.schemastore.org/sarif-2.1.0.json"
HELP_BASE = "https://github.com/alimtvnetwork/coding-guidelines-v23/blob/main/spec/02-coding-guidelines"

Level = Literal["error", "warning", "note"]


@dataclass(frozen=True)
class Finding:
    rule_id: str
    level: Level
    message: str
    file_path: str
    start_line: int
    start_column: int = 1


@dataclass(frozen=True)
class Rule:
    id: str
    name: str
    short_description: str
    help_uri_relative: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "shortDescription": {"text": self.short_description},
            "helpUri": f"{HELP_BASE}/{self.help_uri_relative}",
        }


@dataclass
class SarifRun:
    tool_name: str
    tool_version: str
    rules: list[Rule] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)

    def add(self, finding: Finding) -> None:
        self.findings.append(finding)

    def to_sarif(self) -> dict:
        return {
            "$schema": SCHEMA_URL,
            "version": "2.1.0",
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "name": self.tool_name,
                            "version": self.tool_version,
                            "informationUri": "https://github.com/alimtvnetwork/coding-guidelines-v23",
                            "rules": [r.to_dict() for r in self.rules],
                        }
                    },
                    "results": [self._result(f) for f in self.findings],
                }
            ],
        }

    def _result(self, f: Finding) -> dict:
        return {
            "ruleId": f.rule_id,
            "level": f.level,
            "message": {"text": f.message},
            "locations": [
                {
                    "physicalLocation": {
                        "artifactLocation": {"uri": f.file_path},
                        "region": {"startLine": f.start_line, "startColumn": f.start_column},
                    }
                }
            ],
        }


def emit(run: SarifRun, fmt: str, output: str | None) -> int:
    """Write SARIF or text. Returns exit code: 0 clean, 1 findings."""
    if fmt == "sarif":
        payload = json.dumps(run.to_sarif(), indent=2)
    else:
        payload = _text_report(run)

    if output:
        with open(output, "w", encoding="utf-8") as fh:
            fh.write(payload)
    else:
        sys.stdout.write(payload)
        if not payload.endswith("\n"):
            sys.stdout.write("\n")

    return 1 if run.findings else 0


def _text_report(run: SarifRun) -> str:
    if not run.findings:
        return f"✅ {run.tool_name}: no findings"
    lines = [f"❌ {run.tool_name}: {len(run.findings)} finding(s)"]
    for f in run.findings:
        lines.append(f"  [{f.level}] {f.file_path}:{f.start_line}  {f.rule_id}  {f.message}")
    return "\n".join(lines)
