-- ✅ Entity table with Description
CREATE TABLE AgentSite (
    AgentSiteId INTEGER PRIMARY KEY AUTOINCREMENT,
    SiteName    TEXT NOT NULL,
    Description TEXT NULL
);

-- ✅ Lookup table with Description
CREATE TABLE TransactionStatus (
    TransactionStatusId INTEGER PRIMARY KEY AUTOINCREMENT,
    StatusCode          TEXT NOT NULL UNIQUE,
    Description         TEXT NULL
);

-- ✅ Transactional table with Notes + Comments
CREATE TABLE Transaction (
    TransactionId INTEGER PRIMARY KEY AUTOINCREMENT,
    AgentSiteId   INTEGER NOT NULL,
    Amount        REAL    NOT NULL,
    Notes         TEXT NULL,
    Comments      TEXT NULL
);

-- ✅ Audit table with Notes
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
