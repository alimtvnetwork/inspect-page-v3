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

-- Description marked NOT NULL with DEFAULT (Rule 12)
CREATE TABLE Plugin (
    PluginId    INTEGER PRIMARY KEY AUTOINCREMENT,
    PluginName  TEXT NOT NULL,
    Description TEXT NOT NULL DEFAULT ''
);

-- Audit table missing Notes; Comments present but NOT NULL (Rule 11 + 12)
CREATE TABLE CommandHistory (
    CommandHistoryId INTEGER PRIMARY KEY AUTOINCREMENT,
    Command          TEXT NOT NULL,
    Comments         TEXT NOT NULL
);
