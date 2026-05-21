# Fixture & Diagnostics Format

> **Audience:** anyone (human or AI) adding a new linter rule, a new
> fixture to an existing rule, or a new test against the shared
> harness. Read this once and you will not have to reverse-engineer
> any other check to land a green PR.

This document is the **single source of truth** for:

1. Where fixtures live and how to name them.
2. What a fixture file MUST and MUST NOT contain.
3. The `Finding` shape every check returns.
4. The CLI surface every check inherits from `_lib/`.
5. The exact text + SARIF output the harness will produce.
6. The unit-test contract that locks all of the above in place.

If anything in your check disagrees with this document, the
document wins — open a PR to update the doc *and* the check, never
just the check.

---

## 1. Fixture folder layout

Every rule that has its own scanner ships fixtures under:

```
linters-cicd/checks/<rule-slug>/fixtures/<filename>.<ext>
```

Rules:

- One folder per rule slug. Never share a `fixtures/` directory
  between two rules — it makes per-rule unit tests ambiguous.
- The folder MUST contain at least one **dirty** file and one
  **clean** file per language the rule targets. If the rule scans
  both `.php` and `.ts`, you ship `dirty.php` + `clean.php` AND
  `dirty.ts` + `clean.ts`.
- Extra fixtures are allowed for edge cases (e.g. waivers,
  comments-only, multi-line statements). Name them descriptively:
  `waived-block.sql`, `multiline.ts`, `unicode.php`.
- Fixtures are committed source files. They MUST be hermetic — no
  network, no env vars, no `include`/`require` of files outside the
  fixtures folder, no generated content.

### 1.1 Filename convention

Two patterns currently exist in the repo:

| Pattern | Status | When to use |
|---|---|---|
| `dirty.<ext>` + `clean.<ext>` | **Recommended** for all new rules | Default. Used by the `_template/` starter kit. |
| `bad.<ext>` + `good.<ext>` | Legacy, accepted | Only when extending a rule that already uses `bad/good` (`free-text-columns/`, `missing-desc/`). |

Do NOT mix the two patterns inside the same rule folder. Pick one
and stay consistent.

### 1.2 What a `dirty` fixture MUST contain

- The **minimum** source needed to trigger every code path the
  scanner handles. If your regex has three alternatives, the dirty
  fixture covers all three.
- An inline comment on each violating line pointing at the
  expected rule ID and the expected line number, so a human
  reviewer can verify findings without running the scanner:

  ```php
  var_dump($rows);                 // ← TEMPLATE-001 (warning, line 6)
  ```

- A short header comment explaining the file's purpose and warning
  future contributors not to "clean it up":

  ```php
  <?php
  // This file is a fixture for TEMPLATE-001 tests.
  // It MUST trigger findings — do not "clean up" the violations.
  ```

### 1.3 What a `dirty` fixture SHOULD also contain

At least one **negative-control** snippet — code that *looks* like a
violation but isn't, and therefore MUST NOT be flagged. The most
common shapes:

- The forbidden call inside a `// …` or `/* … */` comment.
- The forbidden call inside a string literal (`"var_dump should not run"`).
- A function with a similar name (`my_var_dump()`).

Place each negative control on its own line and label it:

```php
// The next call is in a comment — must NOT be flagged.
// var_dump('not a real call');
```

The accompanying test asserts these line numbers do NOT appear in
the findings list. See §6.3.

### 1.4 What a `clean` fixture MUST contain

- The same domain as the dirty fixture, written the **right way**.
  Same imports, same shape, same function names — only the
  violation removed.
- Zero findings when scanned.
- No `// linter-skip` / `# noqa` style suppressions. A clean
  fixture must be naturally clean.

### 1.5 Fixtures the linter MUST NOT scan in production

The orchestrator (`run-all.sh`) and the test runner deliberately
walk only the paths you pass via `--path`. Your fixtures are never
scanned by the production rule pack because the registry points at
`spec/`, `src/`, etc. — not at `linters-cicd/checks/*/fixtures/`.

If you ever need to exclude fixtures explicitly (e.g. when running
`run-all.sh` against the whole repo), use:

```bash
bash linters-cicd/run-all.sh \
  --path . \
  --exclude-paths 'linters-cicd/checks/**/fixtures/**'
```

### 1.6 Inline annotation grammar (locked by tests)

The inline comments in §1.2 and §1.3 are **machine-checked** by
`linters-cicd/tests/test_fixture_annotations.py`. Add your fixture
to the `ANNOTATED_FIXTURES` tuple in that test once and the
annotations become a contract the scanner cannot silently break —
especially across changes to `strip_comments_and_strings()` and
similar text-stripping helpers.

Two grammars are recognised. Anything else containing the `←`
arrow is treated as a malformed annotation and fails the test
loudly.

| Form | Meaning |
|---|---|
| `← <RULE-ID> (error\|warning\|note, line N)` | This line MUST be flagged with that rule and level. `N` MUST equal the line the annotation sits on. |
| `← NO-FINDING` | This line MUST stay silent — used for negative controls (e.g. the forbidden call inside a comment or string). |

The validator asserts:

1. Every `← <RULE-ID>` line shows up in the scanner output with
   the matching rule and level.
2. No un-annotated lines are flagged (no surprise findings).
3. Every `← NO-FINDING` line stays out of the findings list — this
   directly catches regressions in the comment/string stripper.
4. The literal `line N` in the annotation equals the actual line
   number, so stale "line 6" comments after lines move are caught
   immediately.

Worked example (matches `checks/_template/fixtures/dirty.php`):

```php
<?php
// This file is a fixture for TEMPLATE-001 tests.
// It MUST trigger findings — do not "clean up" the violations.

function debugMe(array $rows): void {
    var_dump($rows);                 // ← TEMPLATE-001 (warning, line 6)
    print_r($rows, true);            // ← TEMPLATE-001 (warning, line 7)
    error_log("Got " . count($rows));// ← TEMPLATE-001 (warning, line 8)
}

// The next call is in a comment — must NOT be flagged.
// var_dump('not a real call');  ← NO-FINDING
```

---

## 2. The `Finding` contract

Every check's `scan(path, root)` function MUST return a
`list[Finding]`. The dataclass is defined in
`linters-cicd/checks/_lib/sarif.py`:

```python
@dataclass(frozen=True)
class Finding:
    rule_id: str           # e.g. "TEMPLATE-001" — must match registry.json
    level: Level           # "error" | "warning" | "note"
    message: str           # human-readable, ends without trailing period
    file_path: str         # repo-relative posix path (use _lib.walker.relpath)
    start_line: int        # 1-based line number
    start_column: int = 1  # 1-based; default 1 unless you can be more precise
```

Rules:

- `rule_id` MUST be the same string that appears as the key in
  `checks/registry.json`. The harness will refuse to dispatch a
  rule whose findings carry a different ID.
- `level` semantics:
  - `"error"` blocks merges. Reserve for genuine must-fix
    violations (security, data corruption, broken contracts).
  - `"warning"` advises. CI exits non-zero on warnings too, but the
    convention is that warnings can be triaged before release while
    errors block immediately.
  - `"note"` is informational; rarely used.
- `message` MUST cite the offending construct, ideally quoting it
  with backticks, and MUST tell the reader the fix in one clause:

  ```
  `var_dump()` debug call left in source — remove before merging.
  ```

- `file_path` MUST be passed through `_lib.walker.relpath(path, root)`
  so SARIF consumers (GitHub code-scanning, SonarQube) can resolve
  it against the repo root.
- `start_line` is computed from the original source, not the
  comment-stripped copy. If you strip comments before scanning, use
  `text.count("\n", 0, m.start()) + 1` against the **stripped**
  text only when the comment-stripping preserves newlines (which
  the canonical `strip_comments()` in `_template/php.py` does).

---

## 3. The CLI every check inherits

`build_parser(description)` in `_lib/cli.py` adds these flags to
every check automatically. Do not redefine them.

| Flag | Default | Purpose |
|---|---|---|
| `--path DIR` | `.` | Directory to scan |
| `--format {sarif,text}` | `sarif` | Output format |
| `--output FILE` | stdout | Write to file instead of stdout |
| `--exclude-paths CSV` | `""` | fnmatch globs to skip (e.g. `vendor/**,**/*.gen.go`) |
| `--version` | — | Prints `coding-guidelines/<rule-slug> <X.Y.Z>` and exits |

`emit(run, fmt, output)` returns the process exit code:

| Findings | Exit code |
|---|---|
| 0 | `0` |
| ≥ 1 | `1` |

The orchestrator aggregates these: any rule exiting `1` causes
`run-all.sh` to exit `1`.

---

## 4. Expected diagnostic output

### 4.1 Text format (`--format text`)

Clean run:

```
✅ <tool-name>: no findings
```

Dirty run (one finding per line, two-space indent):

```
❌ <tool-name>: 3 finding(s)
  [warning] checks/_template/fixtures/dirty.php:6  TEMPLATE-001  `var_dump()` debug call left in source — remove before merging.
  [warning] checks/_template/fixtures/dirty.php:7  TEMPLATE-001  `print_r()` debug call left in source — remove before merging.
  [warning] checks/_template/fixtures/dirty.php:8  TEMPLATE-001  `error_log()` debug call left in source — remove before merging.
```

Format breakdown:

```
  [<level>] <file_path>:<start_line>  <rule_id>  <message>
```

- Two-space leading indent.
- Level wrapped in square brackets.
- File path and 1-based line, separated by `:`.
- **Two spaces** between `<line>` and `<rule_id>`, and again
  between `<rule_id>` and `<message>`. The harness relies on this
  spacing in some grep-based fixtures — keep it.

### 4.2 SARIF 2.1.0 (`--format sarif`)

Top-level shape (abbreviated):

```json
{
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "<tool-name>",
          "version": "<X.Y.Z>",
          "informationUri": "https://github.com/alimtvnetwork/coding-guidelines-v23",
          "rules": [
            {
              "id": "TEMPLATE-001",
              "name": "LeftoverDebugCall",
              "shortDescription": { "text": "Remove var_dump() / print_r() / error_log() debug calls before merging to main." },
              "helpUri": "https://github.com/alimtvnetwork/coding-guidelines-v23/blob/main/spec/02-coding-guidelines/02-coding-guidelines/06-cicd-integration/02-plugin-model.md"
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "TEMPLATE-001",
          "level": "warning",
          "message": { "text": "`var_dump()` debug call left in source — remove before merging." },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": { "uri": "checks/_template/fixtures/dirty.php" },
                "region": { "startLine": 6, "startColumn": 1 }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

Validate every SARIF you produce with:

```bash
python3 linters-cicd/scripts/validate-sarif.py /tmp/your-rule.sarif
# Expected: exit 0, prints "OK SARIF 2.1.0".
```

### 4.3 Tool-name convention

`SarifRun.tool_name` is the string SARIF consumers display. Use:

```
coding-guidelines-<rule-slug>[-<language>]
```

Examples:

- `coding-guidelines-nested-if-php`
- `coding-guidelines-boolean-naming-go`
- `coding-guidelines-file-length` (single-language `universal`)

The orchestrator's per-rule status line (`✅ <tool-name>: clean`)
derives from this string — keep the slug stable across releases.

---

## 5. The shared scanner skeleton

Every check follows this five-step shape (see
`checks/_template/php.py` for the canonical reference):

```python
# 1. Boilerplate — make _lib importable. Do not change.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files

# 2. Rule metadata.
RULE = Rule(id=..., name=..., short_description=..., help_uri_relative=...)

# 3. Detection pattern (regex, AST visitor, or grammar walk).
PATTERN = re.compile(r"...")

# 4. scan(path, root) -> list[Finding].
def scan(path: Path, root: str) -> list[Finding]: ...

# 5. main() wires CLI -> walker -> scan -> emit.
def main() -> int:
    args = build_parser("…").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="…", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".php"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)
```

---

## 6. The unit-test contract

Every rule MUST ship a test file at
`linters-cicd/tests/test_<rule_slug>.py` that exercises **four**
contracts. The test runner (`linters-cicd/tests/run.py`)
auto-discovers any file matching `test_*.py` under
`linters-cicd/tests/`.

### 6.1 Dirty fixture produces the expected findings

```python
def test_dirty_fixture_produces_three_findings(self) -> None:
    mod = _load("rule_php", RULE_DIR / "php.py")
    findings = mod.scan(RULE_DIR / "fixtures" / "dirty.php",
                        str(RULE_DIR / "fixtures"))
    self.assertEqual(len(findings), 3)
    self.assertEqual({f.rule_id for f in findings}, {"YOUR-RULE-001"})
    self.assertEqual({f.level for f in findings}, {"warning"})
```

Assert exact counts — never `>= 1`. A regression that drops two
out of three findings should fail this test.

### 6.2 Clean fixture is silent

```python
def test_clean_fixture_is_silent(self) -> None:
    mod = _load("rule_php", RULE_DIR / "php.py")
    findings = mod.scan(RULE_DIR / "fixtures" / "clean.php",
                        str(RULE_DIR / "fixtures"))
    self.assertEqual(findings, [])
```

### 6.3 Negative controls are NOT flagged

Pin the line numbers of every negative-control snippet:

```python
def test_comment_only_call_is_not_flagged(self) -> None:
    findings = mod.scan(RULE_DIR / "fixtures" / "dirty.php", ...)
    self.assertNotIn(12, [f.start_line for f in findings])
```

### 6.4 End-to-end CLI run produces the right exit code

```python
def test_cli_exits_one_on_findings(self) -> None:
    out = RULE_DIR / "fixtures" / "_out.sarif"
    rc = subprocess.call([
        sys.executable, str(RULE_DIR / "php.py"),
        "--path", str(RULE_DIR / "fixtures"),
        "--format", "sarif",
        "--output", str(out),
    ])
    try:
        self.assertEqual(rc, 1)
        self.assertTrue(out.exists() and out.stat().st_size > 0)
    finally:
        if out.exists():
            out.unlink()
```

### 6.5 Module-loading helper

Every test file uses the same loader so checks can be imported by
absolute path without polluting `sys.path`:

```python
def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod
```

---

## 7. Verification commands (run these before opening a PR)

```bash
# 7a. Unit tests
python3 linters-cicd/tests/run.py

# 7b. Orchestrator dispatch (text)
bash linters-cicd/run-all.sh \
  --path linters-cicd/checks/<your-slug>/fixtures \
  --rules YOUR-RULE-001 \
  --format text \
  --output /tmp/your-rule.txt
cat /tmp/your-rule.txt
# Expected: exit 1, dirty.<ext> flagged, clean.<ext> silent.

# 7c. SARIF validation
bash linters-cicd/run-all.sh \
  --path linters-cicd/checks/<your-slug>/fixtures \
  --rules YOUR-RULE-001 \
  --format sarif \
  --output /tmp/your-rule.sarif
python3 linters-cicd/scripts/validate-sarif.py /tmp/your-rule.sarif
# Expected: exit 0, "OK SARIF 2.1.0".

# 7d. Cross-link checker (proves help_uri_relative resolves)
python3 linter-scripts/check-spec-cross-links.py --root spec --repo-root .
# Expected: "OK All internal spec cross-references resolve."
```

---

## 8. Cross-references

- Starter kit: [`linters-cicd/checks/_template/README.md`](../checks/_template/README.md)
- Pack overview: [`linters-cicd/README.md`](../README.md)
- SARIF contract: `spec/02-coding-guidelines/06-cicd-integration/01-sarif-contract.md`
- Plugin model:   `spec/02-coding-guidelines/06-cicd-integration/02-plugin-model.md`
- Performance:    `spec/02-coding-guidelines/06-cicd-integration/07-performance.md`
- FAQ:            `spec/02-coding-guidelines/06-cicd-integration/98-faq.md`