-- Souperuser initial schema.
-- Vocabulary: Pots = connected repos, Menus = repo subsets, Tasters = read-only users.

CREATE TABLE installations (
  id INTEGER PRIMARY KEY, -- GitHub App installation id
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE repos (
  repo_id INTEGER PRIMARY KEY, -- GitHub repo id
  installation_id INTEGER NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, -- "owner/name"
  private INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_repos_installation ON repos(installation_id);
CREATE UNIQUE INDEX idx_repos_full_name ON repos(installation_id, full_name);

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  installation_id INTEGER NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL, -- GitHub login of the Cook
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE menu_repos (
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  repo_full_name TEXT NOT NULL,
  PRIMARY KEY (menu_id, repo_full_name)
);

CREATE TABLE tasters (
  id TEXT PRIMARY KEY,
  installation_id INTEGER NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- human-readable, e.g. "Anna (Product)"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX idx_tasters_installation ON tasters(installation_id);

CREATE TABLE invites (
  token TEXT PRIMARY KEY, -- unguessable random token
  installation_id INTEGER NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  menu_id TEXT NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE kitchen_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taster_id TEXT NOT NULL,
  installation_id INTEGER NOT NULL,
  tool TEXT NOT NULL,
  repo TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_kitchen_log_installation ON kitchen_log(installation_id, created_at);
