# Snapshot Fixtures

These JSON files are **golden snapshots** of the SARIF output produced by
the `_template/` starter-kit rules. They are consumed by
`linters-cicd/tests/test_template_sarif_snapshot.py` and exist to detect
silent drift in:

- rule metadata (`id`, `name`, `shortDescription`, `helpUri`)
- finding line numbers and columns
- finding messages (the human-readable fix instructions)
- the tool driver `name` and `version` strings

## Format

A snapshot is a **normalized** projection of the canonical SARIF 2.1.0
document — flatter, deterministic, and easy to diff. One file per
`<rule>/<fixture>` pair. Schema:

```jsonc
{
  "tool":   { "name": "<driver-name>", "version": "<x.y.z>" },
  "rules":  [ { "id", "name", "short_description", "help_uri_relative" }, ... ],
  "results": [
    { "rule_id", "level", "message", "file_path", "start_line", "start_column" },
    ...
  ]
}
```

`help_uri_relative` is the value passed to `Rule(...)` in the check —
i.e. the part after `HELP_BASE/` — so the snapshot stays stable even if
`HELP_BASE` (the GitHub URL prefix) ever moves.

Results are stored in **scan order** (the order the check emits them).
If your rule's natural order is non-deterministic, fix the rule, not
the snapshot.

## Regenerating after an intentional change

If you intentionally change a rule's message, line-number logic, or
metadata, regenerate the snapshot in one shot:

```bash
UPDATE_SNAPSHOTS=1 python3 linters-cicd/tests/run.py
```

Review the diff carefully — every changed byte is a public API change
for SARIF consumers (CI dashboards, IDE plugins, audit logs).

## Adding a new snapshot

1. Drop your fixture under `checks/<slug>/fixtures/dirty.<ext>`.
2. Add a tuple to `SNAPSHOT_CASES` in
   `tests/test_template_sarif_snapshot.py` pointing at the check
   script, the fixture file, and the snapshot path.
3. Run `UPDATE_SNAPSHOTS=1 python3 linters-cicd/tests/run.py` to
   write the baseline.
4. Re-run without the env var; the test must pass clean.