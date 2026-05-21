-- linter-waive: MISSING-DESC-001 reason="Demonstrating block-scoped waiver"
CREATE TABLE WaivedEntity (
    WaivedEntityId INTEGER PRIMARY KEY AUTOINCREMENT,
    Name           TEXT NOT NULL
);

-- This block has NO waiver and SHOULD fire.
CREATE TABLE UnwaivedEntity (
    UnwaivedEntityId INTEGER PRIMARY KEY AUTOINCREMENT,
    Name             TEXT NOT NULL
);
