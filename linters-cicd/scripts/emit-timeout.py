#!/usr/bin/env python3
"""Emit a TOOL-TIMEOUT SARIF document for a check that exceeded its budget.

Spec: spec/02-coding-guidelines/06-cicd-integration/07-performance.md §3
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

TIMEOUT_RULE = {
    "id": "TOOL-TIMEOUT",
    "name": "ToolTimeout",
    "shortDescription": {
        "text": "A check exceeded its configured timeout and was terminated."
    },
    "helpUri": (
        "https://github.com/alimtvnetwork/coding-guidelines-v23/blob/main/"
        "spec/02-coding-guidelines/06-cicd-integration/07-performance.md"
    ),
}


def main() -> int:
    rule_id, lang, seconds, out_path, version = sys.argv[1:6]
    doc = _build(rule_id, lang, seconds, version)
    Path(out_path).write_text(json.dumps(doc, indent=2), encoding="utf-8")
    return 0


def _build(rule_id: str, lang: str, seconds: str, version: str) -> dict:
    msg = (
        f"Check {rule_id}/{lang} exceeded the {seconds}s timeout budget and "
        "was terminated. Either raise --check-timeout or investigate a "
        "regex/AST pathology in the offending plugin."
    )
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": f"coding-guidelines-{rule_id.lower()}-{lang}",
                        "version": version,
                        "informationUri": "https://github.com/alimtvnetwork/coding-guidelines-v23",
                        "rules": [TIMEOUT_RULE],
                    }
                },
                "results": [
                    {
                        "ruleId": "TOOL-TIMEOUT",
                        "level": "error",
                        "message": {"text": msg},
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": "<orchestrator>"},
                                    "region": {"startLine": 1, "startColumn": 1},
                                }
                            }
                        ],
                    }
                ],
            }
        ],
    }


if __name__ == "__main__":
    sys.exit(main())
