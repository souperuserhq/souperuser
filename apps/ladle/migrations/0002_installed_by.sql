-- The dashboard must be scoped to the Cook who installed the app, not to
-- everyone GitHub considers "having access" (that includes all repo
-- collaborators). Recorded from the installation webhook's sender.
ALTER TABLE installations ADD COLUMN installed_by TEXT;

-- Backfill: for personal installations the installer is the account owner.
-- Org installations predating this migration need a manual backfill.
UPDATE installations SET installed_by = account_login WHERE account_type = 'User';
