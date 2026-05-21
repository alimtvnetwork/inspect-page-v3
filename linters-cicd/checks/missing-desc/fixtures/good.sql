-- ✅ Entity table with nullable Description
CREATE TABLE AgentSite (
    AgentSiteId INTEGER PRIMARY KEY AUTOINCREMENT,
    SiteName    TEXT NOT NULL,
    Description TEXT NULL
);

-- ✅ Lookup with nullable Description
CREATE TABLE TransactionStatus (
    TransactionStatusId INTEGER PRIMARY KEY AUTOINCREMENT,
    StatusCode          TEXT NOT NULL UNIQUE,
    Description         TEXT NULL
);

-- ✅ Transactional with Notes + Comments (both nullable, no DEFAULT)
CREATE TABLE Transaction (
    TransactionId INTEGER PRIMARY KEY AUTOINCREMENT,
    AgentSiteId   INTEGER NOT NULL,
    Amount        REAL    NOT NULL,
    Notes         TEXT NULL,
    Comments      TEXT NULL
);

-- ✅ Audit with nullable Notes
CREATE TABLE CommandHistory (
    CommandHistoryId INTEGER PRIMARY KEY AUTOINCREMENT,
    Command          TEXT NOT NULL,
    Notes            TEXT NULL
);

-- ✅ Pure join table — exempt
CREATE TABLE UserRole (
    UserId INTEGER NOT NULL,
    RoleId INTEGER NOT NULL,
    PRIMARY KEY (UserId, RoleId)
);
