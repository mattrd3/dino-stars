-- Dino Stars v1.2 update
-- Adds admin weekly reward controls, improves egg visuals in the app shell, and moves version display to top of admin.

PRAGMA foreign_keys = ON;

UPDATE settings SET value = 'v1.2.0', updated_at = CURRENT_TIMESTAMP WHERE key = 'version';
INSERT OR IGNORE INTO settings (key, value) VALUES ('version', 'v1.2.0');

INSERT OR IGNORE INTO activity_log (id, action_type, actor_name, source, details) VALUES
  ('release_v1_2', 'release_applied', 'System', 'migration', 'Dino Stars v1.2: weekly reward admin controls, egg visual polish and admin version placement.');
