-- Dino Stars v1.2 initial schema
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

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  task_date TEXT NOT NULL,
  task_template_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES people(id),
  FOREIGN KEY (task_template_id) REFERENCES task_templates(id),
  UNIQUE (person_id, task_date, task_template_id)
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
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_person_date ON scheduled_tasks(person_id, task_date);
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
  ('version', 'v1.2.0');

INSERT OR IGNORE INTO people (id, name, role, avatar_emoji, theme_colour, counts_towards_reward, daily_task_count, active, sort_order) VALUES
  ('george', 'George', 'child', '🦖', '#66bb6a', 1, 3, 1, 1),
  ('charlotte', 'Charlotte', 'child', '🐣', '#ffcc80', 0, 3, 1, 2),
  ('mum', 'Mum', 'adult', '🌸', '#f48fb1', 0, 3, 1, 3),
  ('dad', 'Dad', 'adult', '🦕', '#81d4fa', 0, 3, 1, 4);

INSERT OR IGNORE INTO task_templates (id, title, icon, description, active) VALUES
  ('eat_all_dinner', 'Eat all dinner', '🍽️', 'Eat all dinner nicely.', 1),
  ('brush_teeth', 'Brush teeth', '🪥', 'Brush teeth properly.', 1),
  ('be_polite', 'Be polite', '🙂', 'Use kind words, manners and polite listening.', 1),
  ('make_your_bed', 'Make your bed', '🛏️', 'Make your bed and tidy the covers.', 1),
  ('get_dressed', 'Get dressed', '👕', 'Get dressed with good trying.', 1),
  ('eat_lunch_school', 'Eat lunch at school', '🥪', 'Eat lunch well at school.', 1),
  ('read_book', 'Read a book', '📚', 'Read or listen to a story.', 1),
  ('learn_your_words', 'Learn your words', '🔤', 'Practise your words.', 1),
  ('tidy_up', 'Tidy up', '🧸', 'Tidy toys and help put things away.', 1);

INSERT OR IGNORE INTO person_tasks (id, person_id, task_template_id, days_of_week, sort_order, active) VALUES
  ('george_get_dressed', 'george', 'get_dressed', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('george_brush_teeth', 'george', 'brush_teeth', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('george_be_polite', 'george', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 3, 1),

  ('charlotte_tidy_up', 'charlotte', 'tidy_up', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('charlotte_be_polite', 'charlotte', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('charlotte_read_book', 'charlotte', 'read_book', 'mon,tue,wed,thu,fri,sat,sun', 3, 1),

  ('mum_tidy_up', 'mum', 'tidy_up', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('mum_eat_all_dinner', 'mum', 'eat_all_dinner', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('mum_be_polite', 'mum', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 3, 1),

  ('dad_tidy_up', 'dad', 'tidy_up', 'mon,tue,wed,thu,fri,sat,sun', 1, 1),
  ('dad_read_book', 'dad', 'read_book', 'mon,tue,wed,thu,fri,sat,sun', 2, 1),
  ('dad_be_polite', 'dad', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 3, 1);

INSERT OR IGNORE INTO activity_log (id, action_type, actor_name, source, details) VALUES
  ('seed_v1', 'system_seeded', 'System', 'migration', 'Dino Stars initial data created.');
