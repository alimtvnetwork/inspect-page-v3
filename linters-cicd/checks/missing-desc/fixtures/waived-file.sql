-- linter-waive-file: MISSING-DESC-001 reason="Fixture file demonstrating waiver syntax"

-- This whole file is waived; the obvious violations below produce no findings.
CREATE TABLE BadEntity (
    BadEntityId INTEGER PRIMARY KEY AUTOINCREMENT,
    Name        TEXT NOT NULL
);
