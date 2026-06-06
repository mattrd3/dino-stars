-- Dino Stars v1.3 update
-- Reward chest reveal wording and simplified green egg frontend.

PRAGMA foreign_keys = ON;

UPDATE settings SET value = 'v1.3.0', updated_at = CURRENT_TIMESTAMP WHERE key = 'version';
INSERT OR IGNORE INTO settings (key, value) VALUES ('version', 'v1.3.0');

INSERT OR IGNORE INTO activity_log (id, action_type, actor_name, source, details) VALUES
  ('release_v1_3', 'release_applied', 'System', 'migration', 'Dino Stars v1.3: reward chest reveals selected reward after unlock and eggs simplified to clean green eggs.');
