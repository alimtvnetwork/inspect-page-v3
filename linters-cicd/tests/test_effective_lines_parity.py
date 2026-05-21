"""Parity test: the Python and JS effective-lines counters must agree.

Feeds a curated set of fixtures (each tagged with a language) through
``linters-cicd/checks/_lib/effective_lines.count_effective`` AND through
``eslint-plugins/coding-guidelines/_lib/effective-lines.js``'s
``countEffective``. Asserts both return the same integer for every
fixture.

If you change either implementation without changing the other, this
test fails. That is the whole point.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import pytest
except ImportError:  # pragma: no cover - environment guard
    import unittest
    raise unittest.SkipTest("pytest not installed; skipping parity suite")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "linters-cicd" / "checks"))

from _lib.effective_lines import count_effective  # noqa: E402


# (label, language, body_lines, expected_count)
FIXTURES: list[tuple[str, str, list[str], int]] = [
    ("empty", "typescript", [], 0),
    ("blank-only", "typescript", ["", "   ", "\t"], 0),
    ("ts-line-comments", "typescript",
     ["// a", "  // b", "doSomething();"], 1),
    ("ts-block-comment-multiline", "typescript",
     ["/*", " * jsdoc continuation", " * more", " */", "return 1;"], 1),
    ("ts-block-comment-single-line", "typescript",
     ["/* foo */", "return 1;"], 1),
    ("go-mixed", "go",
     ["// header", "x := 1", "/* block", "still block */", "y := 2"], 2),
    # The PHP block-comment fix — middle line is NOT counted.
    ("php-block-comment-middle", "php",
     ["/*", "middle prose", "*/", "echo 'x';"], 1),
    ("php-hash-and-slash", "php",
     ["# hash", "// slash", "echo 'x';"], 1),
    ("rust-triple-slash-doc", "rust",
     ["/// doc", "//// not a doc but starts with //", "let x = 1;"], 1),
    ("python-hash-and-docstring", "python",
     ['"""docstring opener', "actual docstring prose counts (out of scope)",
      '"""', "x = 1", "# trailing"], 2),
    ("python-no-block-comments", "python",
     ["x = 1", "y = 2", "# z", "z = 3"], 3),
    ("indent-preserved", "typescript",
     ["    return 42;"], 1),
]


@pytest.mark.parametrize("label,lang,body,expected",
                         [(f[0], f[1], f[2], f[3]) for f in FIXTURES])
def test_python_counter(label, lang, body, expected):
    assert count_effective(body, lang) == expected, label


@pytest.mark.skipif(shutil.which("node") is None,
                    reason="node not available in this sandbox")
def test_js_counter_matches_python(tmp_path):
    js_lib = ROOT / "eslint-plugins" / "coding-guidelines" / "_lib" / "effective-lines.js"
    assert js_lib.exists(), f"missing JS mirror: {js_lib}"
    runner = tmp_path / "run.mjs"
    runner.write_text(
        "import {countEffective} from " + json.dumps(str(js_lib)) + ";\n"
        "const cases = JSON.parse(process.argv[2]);\n"
        "const out = cases.map(c => countEffective(c.body, c.lang));\n"
        "process.stdout.write(JSON.stringify(out));\n",
        encoding="utf-8",
    )
    payload = json.dumps([
        {"label": label, "lang": lang, "body": body}
        for (label, lang, body, _expected) in FIXTURES
    ])
    result = subprocess.run(
        ["node", str(runner), payload],
        check=True, capture_output=True, text=True,
    )
    js_counts = json.loads(result.stdout)
    py_counts = [count_effective(body, lang) for (_l, lang, body, _e) in FIXTURES]
    assert js_counts == py_counts, list(zip(
        [f[0] for f in FIXTURES], py_counts, js_counts,
    ))
