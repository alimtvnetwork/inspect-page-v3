-- Entity table missing Description (Rule 10)
CREATE TABLE AgentSite (
    AgentSiteId INTEGER PRIMARY KEY AUTOINCREMENT,
    SiteName    TEXT NOT NULL
);

-- Transactional table missing both Notes and Comments (Rule 11)
CREATE TABLE Transaction (
    TransactionId INTEGER PRIMARY KEY AUTOINCREMENT,
    AgentSiteId   INTEGER NOT NULL,
    Amount        REAL    NOT NULL
);

-- Lookup table missing Description (Rule 10)
CREATE TABLE TransactionStatus (
    TransactionStatusId INTEGER PRIMARY KEY AUTOINCREMENT,
    StatusCode          TEXT NOT NULL UNIQUE
);

-- Audit table missing Notes (Rule 11 notes-only variant)
CREATE TABLE CommandHistory (
    CommandHistoryId INTEGER PRIMARY KEY AUTOINCREMENT,
    Command          TEXT NOT NULL
);
