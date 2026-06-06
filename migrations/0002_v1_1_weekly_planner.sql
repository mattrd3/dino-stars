-- Dino Stars v1.1 update
-- Adds planned day-by-day tasks, cleans up the task library and bumps version.

PRAGMA foreign_keys = ON;

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

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_person_date ON scheduled_tasks(person_id, task_date);

UPDATE settings SET value = 'v1.1.0', updated_at = CURRENT_TIMESTAMP WHERE key = 'version';
INSERT OR IGNORE INTO settings (key, value) VALUES ('version', 'v1.1.0');

-- Deactivate the old starter task library so admin only sees the cleaned list.
UPDATE task_templates SET active = 0, updated_at = CURRENT_TIMESTAMP
WHERE id NOT IN (
  'eat_all_dinner',
  'brush_teeth',
  'be_polite',
  'make_your_bed',
  'get_dressed',
  'eat_lunch_school',
  'read_book',
  'learn_your_words',
  'tidy_up'
);

INSERT INTO task_templates (id, title, icon, description, active, updated_at) VALUES
  ('eat_all_dinner', 'Eat all dinner', '🍽️', 'Eat all dinner nicely.', 1, CURRENT_TIMESTAMP),
  ('brush_teeth', 'Brush teeth', '🪥', 'Brush teeth properly.', 1, CURRENT_TIMESTAMP),
  ('be_polite', 'Be polite', '🙂', 'Use kind words, manners and polite listening.', 1, CURRENT_TIMESTAMP),
  ('make_your_bed', 'Make your bed', '🛏️', 'Make your bed and tidy the covers.', 1, CURRENT_TIMESTAMP),
  ('get_dressed', 'Get dressed', '👕', 'Get dressed with good trying.', 1, CURRENT_TIMESTAMP),
  ('eat_lunch_school', 'Eat lunch at school', '🥪', 'Eat lunch well at school.', 1, CURRENT_TIMESTAMP),
  ('read_book', 'Read a book', '📚', 'Read or listen to a story.', 1, CURRENT_TIMESTAMP),
  ('learn_your_words', 'Learn your words', '🔤', 'Practise your words.', 1, CURRENT_TIMESTAMP),
  ('tidy_up', 'Tidy up', '🧸', 'Tidy toys and help put things away.', 1, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  icon = excluded.icon,
  description = excluded.description,
  active = 1,
  updated_at = CURRENT_TIMESTAMP;

-- Keep a sensible fallback assignment for every person. The new Weekly Planner overrides these when a day is planned.
INSERT INTO person_tasks (id, person_id, task_template_id, days_of_week, sort_order, active, updated_at) VALUES
  ('george_get_dressed', 'george', 'get_dressed', 'mon,tue,wed,thu,fri,sat,sun', 1, 1, CURRENT_TIMESTAMP),
  ('george_brush_teeth', 'george', 'brush_teeth', 'mon,tue,wed,thu,fri,sat,sun', 2, 1, CURRENT_TIMESTAMP),
  ('george_be_polite', 'george', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 3, 1, CURRENT_TIMESTAMP),

  ('charlotte_tidy_up', 'charlotte', 'tidy_up', 'mon,tue,wed,thu,fri,sat,sun', 1, 1, CURRENT_TIMESTAMP),
  ('charlotte_be_polite', 'charlotte', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 2, 1, CURRENT_TIMESTAMP),
  ('charlotte_read_book', 'charlotte', 'read_book', 'mon,tue,wed,thu,fri,sat,sun', 3, 1, CURRENT_TIMESTAMP),

  ('mum_tidy_up', 'mum', 'tidy_up', 'mon,tue,wed,thu,fri,sat,sun', 1, 1, CURRENT_TIMESTAMP),
  ('mum_eat_all_dinner', 'mum', 'eat_all_dinner', 'mon,tue,wed,thu,fri,sat,sun', 2, 1, CURRENT_TIMESTAMP),
  ('mum_be_polite', 'mum', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 3, 1, CURRENT_TIMESTAMP),

  ('dad_tidy_up', 'dad', 'tidy_up', 'mon,tue,wed,thu,fri,sat,sun', 1, 1, CURRENT_TIMESTAMP),
  ('dad_read_book', 'dad', 'read_book', 'mon,tue,wed,thu,fri,sat,sun', 2, 1, CURRENT_TIMESTAMP),
  ('dad_be_polite', 'dad', 'be_polite', 'mon,tue,wed,thu,fri,sat,sun', 3, 1, CURRENT_TIMESTAMP)
ON CONFLICT(person_id, task_template_id) DO UPDATE SET
  days_of_week = excluded.days_of_week,
  sort_order = excluded.sort_order,
  active = 1,
  updated_at = CURRENT_TIMESTAMP;

INSERT OR IGNORE INTO activity_log (id, action_type, actor_name, source, details) VALUES
  ('release_v1_1', 'release_applied', 'System', 'migration', 'Dino Stars v1.1: better eggs, cleaned task list and Weekly Planner added.');
