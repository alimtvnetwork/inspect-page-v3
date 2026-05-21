# CODE-RED-005 — Function Length (Strict 8)

> **Status:** `error` (build-failing) · **Spec source of truth:** this file
> **Owners:** `linters-cicd/checks/function-length-prefer8/` + `eslint-plugins/coding-guidelines/index.js#preferFunctionLines`
> **Last reviewed:** 2026-04-27

This is the **single, canonical** specification for how the strict 8-line
function-length rule is measured and enforced. All other surfaces
(`spec/.../06-rules-mapping.md`, `.lovable/coding-guidelines/coding-guidelines.md`,
the root `readme.md`, the rule docstrings) link **here**. If you change
the threshold or counting rules, update this file first; the others must
follow.

---

## 1. Threshold (the only number that matters)

```
STRICT_LINES = 8     # owned by CODE-RED-005 — binding cap
LEGACY_HARD  = 15    # owned by CODE-RED-004 — redundant safety net
```

A function is **in violation** when its *effective body line count*
(see §2) is **strictly greater than 8**.

| Effective lines | CODE-RED-005 | CODE-RED-004 | Build outcome |
|----------------:|--------------|--------------|---------------|
| 0 – 8           | silent       | silent       | ✅ pass       |
| 9 – 15          | **error**    | silent       | ❌ fail       |
| 16+             | **error**    | error (redundant) | ❌ fail  |

There is no warning band. There is no soft tier. `9` fails the build
just as hard as `9000`.

---

## 2. What counts as an "effective body line"

> **Single executable source of truth:**
> [`linters-cicd/checks/_lib/effective_lines.py`](../_lib/effective_lines.py)
> (function `count_effective(body_lines, language)`).
> JS mirror: [`eslint-plugins/coding-guidelines/_lib/effective-lines.js`](../../../eslint-plugins/coding-guidelines/_lib/effective-lines.js).
> The two implementations are pinned together by
> [`linters-cicd/tests/test_effective_lines_parity.py`](../../tests/test_effective_lines_parity.py),
> which feeds the same fixtures through both and asserts identical
> output. **Both CODE-RED-004 and CODE-RED-005 — across every language
> and across both ESLint and the Python SARIF scanners — call the same
> counter.** There is exactly one definition.

Every scanner counts lines **inside the function body** — i.e.
**strictly between** the line containing the opening `{` (or `def …:`)
and the line containing the matching close. The function signature
line, the closing brace/dedent, and lines outside the body are
**never** counted; callers do that body slicing themselves before
calling the counter.

A line in the body **is counted** iff, after `.strip()`, it is **not**
one of the following:

| Skip rule                       | Go / TS / JS / Rust / PHP | Python |
|---------------------------------|:-------------------------:|:------:|
| Empty / whitespace-only         | ✅ skip                   | ✅ skip |
| Single-line comment             | line starts with `//` (also `///` for Rust; also `#` for PHP) | line starts with `#` |
| Block-comment opener            | line starts with `/*`     | n/a    |
| Block-comment continuation/close | every line until the closing `*/` is matched (state-tracked) | n/a |
| Single-line block comment       | `/* foo */` on one line — skipped, state stays clean | n/a |
| Docstring opener / closer line  | n/a                       | line starts with `"""` or `'''` |

**Everything else counts as one line — including:**

- A statement spread across multiple physical lines (each physical
  line counts; the rule is line-based, not statement-based, by design
  — this discourages "hide-the-statement" reformatting to dodge the
  cap).
- Lines that are *only* a `}` or `)` or `];` if they sit on their own.
- `return` statements, `await` lines, decorators inside the body.
- Lines inside nested functions / closures (the outer function carries
  the cost of bodies it lexically contains).
- Prose lines in the **middle** of a multi-line Python docstring. Only
  the opener and closer lines are skipped; everything between them
  counts. This is intentional — docstrings belong on the function, not
  buried mid-body. If you want to suppress them, use `#` comments.

**Edge cases the counter deliberately handles uniformly across all
C-family languages** (this matters because previous per-language
counters disagreed; the unified module ends that drift):

- Multi-line `/* … */` block comments: middle lines are skipped via
  state tracking, not by surface-pattern matching `*`. (PHP's old
  CODE-RED-004 counter got this wrong — it only skipped lines
  *starting with* `*`, so middle lines without that prefix were
  counted. Fixed.)
- Single-line `/* foo */`: skipped without entering block-comment
  state, so the next line is evaluated normally.
- A bare `*` line **outside** any block comment is now counted (it
  would be a syntax error in any C-family language anyway, so this is
  not a behavior change for valid code).

If you need to add a language, add it to the `SYNTAX` registry in the
Python module and the JS mirror — do **not** introduce a new local
counter.

---

## 3. What "function" means per language

The rule fires on every construct that has a body:

| Language   | Construct(s)                                       | Detector |
|------------|----------------------------------------------------|----------|
| TypeScript / JavaScript | `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression` (with `BlockStatement` body), class methods | ESLint AST |
| Go         | `func Name(...) {`, `func (r Recv) Name(...) {`    | regex + brace balance |
| PHP        | `function name(...) {`, modifier-prefixed methods  | regex + brace balance |
| Python     | `def name(...):`, `async def name(...):`           | regex + indentation |
| Rust       | `fn name(...) [-> T] {` (incl. `pub`, `async`, `unsafe`, `const`) | regex + brace balance |

Arrow functions with **expression bodies** (no `{ }`) are not measured —
they are by definition one expression and cannot exceed the cap.

---

## 4. Scope: what the rule does NOT do

- **No length-of-file aggregation.** That is CODE-RED-006
  (`checks/file-length/`).
- **No cyclomatic complexity.** Lines are a proxy, not the metric of
  record. A 6-line function with 4 nested ternaries still passes
  CODE-RED-005 (and is then caught by CODE-RED-001 / no-nested-if).
- **No automatic refactor.** The rule reports; the human decides
  whether to extract, inline, or waiver.

---

## 5. Waivers

There is **no waiver mechanism** for CODE-RED-005 today. A future
`// CODE-RED-005-WAIVER: <reason>` pattern is reserved but not
implemented; introducing it requires updating §1 of this file and the
mapping table in `spec/02-coding-guidelines/06-cicd-integration/06-rules-mapping.md`.

If you need to ship code that exceeds 8 lines today and refactor is
not viable, the supported escape hatches are:

1. Extract a helper (preferred — usually trivial).
2. Disable the rule on the specific line via the underlying linter's
   own disable comment (e.g.
   `// eslint-disable-next-line coding-guidelines/prefer-function-lines`).
   Each such disable is a debt marker and should be tracked.

The CI scanners (Python-driven, in `linters-cicd/checks/`) do **not**
honour ESLint disable comments. They will still emit a SARIF `error`
for the same function. This is intentional — the strict cap is global.

---

## 6. Verifying a change to this rule

If you modify any counter, threshold, or detector, you **must** re-run:

```bash
python3 -m pytest linters-cicd/tests/test_prefer8_fires_on_fixture.py -v
python3 -m pytest linters-cicd/tests/test_function_length_*.py -v
npm run lint -- --no-warn-ignored
```

The fixture at
`linters-cicd/tests/fixtures/code-red-005/too-long.ts` is calibrated to
**11 effective lines**. Tests assert it triggers `CODE-RED-005` at
`error` level and that `CODE-RED-004` stays silent. Do not "fix" the
fixture to 8 lines — it is the canary.

---

## 7. Cross-references (must agree with this file)

- `spec/02-coding-guidelines/06-cicd-integration/06-rules-mapping.md` —
  registry-level mapping table.
- `.lovable/coding-guidelines/coding-guidelines.md` — Rule #1
  developer-facing summary.
- `linters-cicd/checks/function-length-prefer8/_shared.py` — `RULE`
  metadata + `STRICT_LINES` constant (the **executable** source of
  truth; this README is the **prose** source of truth — if they
  disagree, treat it as a P1 bug and fix here first).
- `eslint-plugins/coding-guidelines/index.js` — `preferFunctionLines`
  rule + `countEffectiveBodyLines` helper.
- Root `readme.md` — links here from the "Coding standards" section.
