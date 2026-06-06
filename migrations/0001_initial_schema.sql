-- Dino Stars v1 initial schema
-- Cloudflare D1 / SQLite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('child', 'adult')),
  avatar_emoji TEXT NOT NULL,
  theme_colour TEXT,
  counts_towards_reward INTEGER NOT NULL DEFAULT 0,
  daily_task_count INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS person_tasks (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  task_template_id TEXT NOT NULL,
  days_of_week TEXT NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (task_template_id) REFERENCES task_templates(id),
  UNIQUE (person_id, task_template_id)
);

CREATE TABLE IF NOT EXISTS task_completions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  task_template_id TEXT NOT NULL,
  task_date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_by TEXT,
  source TEXT NOT NULL DEFAULT 'child',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (person_id, task_template_id, task_date),
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (task_template_id) REFERENCES task_templates(id)
);

CREATE TABLE IF NOT EXISTS weekly_rewards (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  reward_text TEXT NOT NULL,
  target_stars INTEGER NOT NULL DEFAULT 15,
  unlocked INTEGER NOT NULL DEFAULT 0,
  unlocked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (person_id, week_start_date),
  FOREIGN KEY (person_id) REFERENCES people(id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  actor_name TEXT,
  person_id TEXT,
  task_template_id TEXT,
  task_date TEXT,
  old_value TEXT,
  new_value TEXT,
  source TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_completions_person_date ON task_completions(person_id, task_date);
CREATE INDEX IF NOT EXISTS idx_completions_date ON task_completions(task_date);
CREATE INDEX IF NOT EXISTS idx_person_tasks_person ON person_tasks(person_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_weekly_rewards_person_week ON weekly_rewards(person_id, week_start_date);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('app_name', 'Dino Stars'),
  ('theme', 'dino_jungle'),
  ('timezone', 'Europe/London'),
  ('week_starts_on', 'monday'),
  ('default_daily_task_count', '3'),
  ('default_weekly_target', '15'),
  ('current_reward_text', 'Reward chest surprise'),
  ('admin_pin_hash', 'a1fb4e703a9ef1fa4936801721ff285a97ac85330856674412e054892afe6972'),
  ('version', 'v1.0.0');

INSERT OR IGNORE INTO people (id, name, role, avatar_emoji, theme_colour, counts_towards_reward, daily_task_count, active, sort_order) VALUES
  ('george', 'George', 'child', '🦖', '#66bb6a', 1, 3, 1, 1),
  ('charlotte', 'Charlotte', 'child', '🐣', '#ffcc80', 0, 3, 1, 2),
  ('mum', 'Mum', 'adult', '🌸', '#f48fb1', 0, 3, 1, 3),
  ('dad', 'Dad', 'adult', '🦕', '#81d4fa', 0, 3, 1, 4);

INSERT OR IGNORE INTO task_templates (id, title, icon, description, active) VALUES
  ('brush_teeth', 'Brush teeth', '🦷', 'Brush teeth nicely.', 1),
  ('tidy_toys', 'Tidy toys', '🧸', 'Put toys back where they belong.', 1),
  ('kind_words', 'Kind words', '❤️', 'Use kind words or do something kind.', 1),
  ('get_dressed', 'Get dressed', '👕', 'Get dressed with good trying.', 1),
  ('wash_hands', 'Wash hands', '🧼', 'Wash hands properly.', 1),
  ('share_toys', 'Share toys', '🤝', 'Share or take turns.', 1),
  ('help_tidy_table', 'Help tidy table', '🍽️', 'Help with the table or plates.', 1),
  ('try_dinner', 'Try dinner', '🥦', 'Try dinner or new food.', 1),
  ('read_book', 'Read a book', '📚', 'Read or listen to a story.', 1),
  ('good_listening', 'Good listening', '👂', 'Listen well and try hard.', 1),
  ('washing', 'Washing', '🧺', 'Help with washing.', 1),
  ('bins_tidy', 'Bins / tidy', '🗑️', 'Bins, tidy or helpful job.', 1);

INSERT OR IGNORE INTO person_tasks (id, person_id, task_template_id, days_of_week, sort_order, active) VALUES
  ('george_brush_teeth', 'george', 'brush_teeth', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('george_tidy_toys', 'george', 'tidy_toys', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('george_kind_words', 'george', 'kind_words', 'mon,tue,wed,thu,fri,sat,sun', 3, 1),

  ('charlotte_tidy_toys', 'charlotte', 'tidy_toys', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('charlotte_share_toys', 'charlotte', 'share_toys', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('charlotte_kind_words', 'charlotte', 'kind_words', 'mon,tue,wed,thu,fri,sat,sun', 3, 1),

  ('mum_help_tidy_table', 'mum', 'help_tidy_table', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('mum_washing', 'mum', 'washing', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('mum_kind_words', 'mum', 'kind_words', 'mon,tue,wed,thu,fri,sat,sun', 3, 1),

  ('dad_bins_tidy', 'dad', 'bins_tidy', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('dad_read_book', 'dad', 'read_book', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('dad_kind_words', 'dad', 'kind_words', 'mon,tue,wed,thu,fri,sat,sun', 3, 1);

INSERT OR IGNORE INTO activity_log (id, action_type, actor_name, source, details) VALUES
  ('seed_v1', 'system_seeded', 'System', 'migration', 'Dino Stars initial data created.');
