const VERSION = "v1.3.0";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "") || "state";

  try {
    if (!env.DB) return json({ ok: false, error: "D1 binding DB is missing." }, 500);

    if (request.method === "OPTIONS") return json({ ok: true });
    if (request.method === "GET" && path === "health") return health(env);
    if (request.method === "GET" && path === "state") return state(env);
    if (request.method === "POST" && path === "complete-task") return completeTask(request, env);
    if (request.method === "POST" && path === "undo-task") return undoTask(request, env);
    if (request.method === "POST" && path === "admin/check-pin") return checkPinRoute(request, env);
    if (request.method === "POST" && path === "admin/settings") return saveSettings(request, env);
    if (request.method === "POST" && path === "admin/reward") return saveReward(request, env);
    if (request.method === "POST" && path === "admin/person") return savePerson(request, env);
    if (request.method === "POST" && path === "admin/task") return saveTask(request, env);
    if (request.method === "POST" && path === "admin/assignment") return saveAssignment(request, env);
    if (request.method === "POST" && path === "admin/schedule-day") return saveScheduleDay(request, env);
    if (request.method === "POST" && path === "admin/copy-day") return copyScheduleDay(request, env);
    if (request.method === "POST" && path === "admin/reset-week") return resetWeek(request, env);
    if (request.method === "GET" && path === "admin/activity-log") return activityLog(request, env);

    return json({ ok: false, error: `Unknown route: ${request.method} /api/${path}` }, 404);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: err?.message || "Unexpected error" }, 500);
  }
}

async function health(env) {
  const settings = await getSettings(env);
  return json({ ok: true, app: settings.app_name || "Dino Stars", version: VERSION, db: "connected" });
}

async function state(env) {
  const payload = await buildState(env);
  return json({ ok: true, ...payload });
}

async function buildState(env) {
  const settings = await getSettings(env);
  const today = getUKDate();
  const weekStartDate = getWeekStart(today);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
  const weekEndDate = weekDates[6];

  await ensureWeeklyRewards(env, weekStartDate, settings);

  const people = await env.DB.prepare(
    `SELECT * FROM people WHERE active = 1 ORDER BY sort_order, name`
  ).all();

  const assignmentRows = await env.DB.prepare(
    `SELECT pt.id AS assignment_id, pt.person_id, pt.task_template_id, pt.days_of_week,
            pt.sort_order, tt.title, tt.icon, tt.description
       FROM person_tasks pt
       JOIN task_templates tt ON tt.id = pt.task_template_id
      WHERE pt.active = 1 AND tt.active = 1
      ORDER BY pt.person_id, pt.sort_order, tt.title`
  ).all();

  const scheduledRows = await env.DB.prepare(
    `SELECT st.id AS scheduled_id, st.person_id, st.task_date, st.task_template_id,
            st.sort_order, tt.title, tt.icon, tt.description
       FROM scheduled_tasks st
       JOIN task_templates tt ON tt.id = st.task_template_id
      WHERE st.active = 1 AND tt.active = 1
        AND st.task_date BETWEEN ? AND ?
      ORDER BY st.person_id, st.task_date, st.sort_order, tt.title`
  ).bind(weekStartDate, weekEndDate).all();

  const completions = await env.DB.prepare(
    `SELECT * FROM task_completions
      WHERE task_date BETWEEN ? AND ? AND completed = 1`
  ).bind(weekStartDate, weekEndDate).all();

  const rewards = await env.DB.prepare(
    `SELECT * FROM weekly_rewards WHERE week_start_date = ?`
  ).bind(weekStartDate).all();

  const completionsByKey = new Set((completions.results || []).map(c => `${c.person_id}|${c.task_template_id}|${c.task_date}`));
  const scheduledByPersonDate = {};
  for (const st of scheduledRows.results || []) {
    const key = `${st.person_id}|${st.task_date}`;
    if (!scheduledByPersonDate[key]) scheduledByPersonDate[key] = [];
    scheduledByPersonDate[key].push(st);
  }

  const tasksByPersonByDate = {};
  for (const p of people.results || []) {
    tasksByPersonByDate[p.id] = {};
    for (const date of weekDates) {
      const scheduled = scheduledByPersonDate[`${p.id}|${date}`] || [];
      const personTaskLimit = Number(p.daily_task_count || settings.default_daily_task_count || 3);
      const sourceRows = scheduled.length
        ? scheduled
        : (assignmentRows.results || [])
            .filter(t => {
              const dayKey = DAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
              return t.person_id === p.id && String(t.days_of_week || "").split(",").includes(dayKey);
            })
            .slice(0, personTaskLimit);

      tasksByPersonByDate[p.id][date] = sourceRows.map(t => ({
        assignmentId: t.assignment_id || null,
        scheduledId: t.scheduled_id || null,
        taskTemplateId: t.task_template_id,
        title: t.title,
        icon: t.icon,
        description: t.description,
        scheduled: Boolean(t.scheduled_id),
        completed: completionsByKey.has(`${p.id}|${t.task_template_id}|${date}`)
      }));
    }
  }

  const rewardProgress = calculateRewardProgress(people.results || [], tasksByPersonByDate, rewards.results || [], weekDates);

  return {
    version: VERSION,
    settings,
    today,
    weekStartDate,
    weekEndDate,
    weekDates,
    people: people.results || [],
    taskTemplates: await allTaskTemplates(env),
    assignments: assignmentRows.results || [],
    scheduledTasks: scheduledRows.results || [],
    tasksByPersonByDate,
    rewards: rewards.results || [],
    rewardProgress,
    serverTime: new Date().toISOString()
  };
}

function calculateRewardProgress(people, tasksByPersonByDate, rewards, weekDates) {
  const byPerson = {};
  for (const p of people) {
    const reward = rewards.find(r => r.person_id === p.id);
    let possible = 0;
    let completed = 0;
    for (const date of weekDates) {
      const tasks = tasksByPersonByDate[p.id]?.[date] || [];
      possible += tasks.length;
      completed += tasks.filter(t => t.completed).length;
    }
    const target = Number(reward?.target_stars || 0);
    byPerson[p.id] = {
      personId: p.id,
      possibleStars: possible,
      completedStars: completed,
      targetStars: target,
      rewardText: reward?.reward_text || "Reward chest surprise",
      countsTowardsReward: Boolean(p.counts_towards_reward),
      unlocked: Boolean(p.counts_towards_reward && target > 0 && completed >= target)
    };
  }
  return byPerson;
}

async function completeTask(request, env) {
  const body = await readJson(request);
  const personId = cleanId(body.personId);
  const taskTemplateId = cleanId(body.taskTemplateId);
  const taskDate = body.taskDate || getUKDate();
  const source = body.source === "admin" ? "admin" : "child";

  if (!personId || !taskTemplateId) return json({ ok: false, error: "personId and taskTemplateId are required." }, 400);
  if (!isDate(taskDate)) return json({ ok: false, error: "taskDate must be YYYY-MM-DD." }, 400);

  const isPlanned = await env.DB.prepare(
    `SELECT 1 FROM scheduled_tasks WHERE person_id = ? AND task_template_id = ? AND task_date = ? AND active = 1`
  ).bind(personId, taskTemplateId, taskDate).first();

  const isAssigned = await env.DB.prepare(
    `SELECT 1 FROM person_tasks WHERE person_id = ? AND task_template_id = ? AND active = 1`
  ).bind(personId, taskTemplateId).first();

  if (!isPlanned && !isAssigned) return json({ ok: false, error: "That task is not assigned or planned for this person." }, 400);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO task_completions (id, person_id, task_template_id, task_date, completed, completed_at, completed_by, source, updated_at)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(person_id, task_template_id, task_date)
     DO UPDATE SET completed = 1, completed_at = CURRENT_TIMESTAMP, completed_by = excluded.completed_by, source = excluded.source, updated_at = CURRENT_TIMESTAMP`
  ).bind(id, personId, taskTemplateId, taskDate, source, source).run();

  await log(env, {
    action_type: "task_completed",
    actor_name: source === "admin" ? "Parent" : "Child",
    person_id: personId,
    task_template_id: taskTemplateId,
    task_date: taskDate,
    source,
    details: "Task marked complete."
  });

  return json({ ok: true, ...(await buildState(env)) });
}

async function undoTask(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);

  const personId = cleanId(body.personId);
  const taskTemplateId = cleanId(body.taskTemplateId);
  const taskDate = body.taskDate || getUKDate();
  if (!personId || !taskTemplateId || !isDate(taskDate)) return json({ ok: false, error: "Invalid undo request." }, 400);

  await env.DB.prepare(
    `UPDATE task_completions SET completed = 0, updated_at = CURRENT_TIMESTAMP
      WHERE person_id = ? AND task_template_id = ? AND task_date = ?`
  ).bind(personId, taskTemplateId, taskDate).run();

  await log(env, {
    action_type: "task_undone",
    actor_name: "Parent",
    person_id: personId,
    task_template_id: taskTemplateId,
    task_date: taskDate,
    source: "admin",
    details: "Task completion undone."
  });

  return json({ ok: true, ...(await buildState(env)) });
}

async function checkPinRoute(request, env) {
  const body = await readJson(request);
  const ok = await verifyPin(env, body.pin);
  if (ok) await log(env, { action_type: "admin_login", actor_name: "Parent", source: "admin", details: "Parent PIN accepted." });
  return json({ ok });
}

async function saveSettings(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);

  const allowed = ["app_name", "theme", "default_daily_task_count", "default_weekly_target", "current_reward_text"];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      await env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
        .bind(key, String(body[key])).run();
    }
  }

  if (body.new_pin) {
    const hash = await sha256(String(body.new_pin));
    await env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('admin_pin_hash', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).bind(hash).run();
  }

  await env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('version', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).bind(VERSION).run();

  await log(env, { action_type: "settings_updated", actor_name: "Parent", source: "admin", details: "Settings updated." });
  return json({ ok: true, ...(await buildState(env)) });
}

async function saveReward(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);

  const personId = cleanId(body.personId);
  const weekStartDate = body.weekStartDate && isDate(body.weekStartDate) ? body.weekStartDate : getWeekStart(getUKDate());
  const rewardText = String(body.rewardText || "Reward chest surprise").trim() || "Reward chest surprise";
  const targetStars = Math.max(0, Math.min(99, Number(body.targetStars || 0)));

  if (!personId) return json({ ok: false, error: "personId is required." }, 400);

  const person = await env.DB.prepare(`SELECT id FROM people WHERE id = ? AND active = 1`).bind(personId).first();
  if (!person) return json({ ok: false, error: "Person not found." }, 404);

  await env.DB.prepare(
    `INSERT INTO weekly_rewards (id, person_id, week_start_date, reward_text, target_stars, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(person_id, week_start_date)
     DO UPDATE SET reward_text = excluded.reward_text, target_stars = excluded.target_stars, updated_at = CURRENT_TIMESTAMP`
  ).bind(`${personId}_${weekStartDate}`, personId, weekStartDate, rewardText, targetStars).run();

  await log(env, {
    action_type: "reward_saved",
    actor_name: "Parent",
    person_id: personId,
    task_date: weekStartDate,
    source: "admin",
    new_value: `${targetStars}|${rewardText}`,
    details: "Weekly reward saved."
  });

  return json({ ok: true, ...(await buildState(env)) });
}

async function savePerson(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);

  const id = cleanId(body.id || slug(body.name));
  if (!id || !body.name) return json({ ok: false, error: "Person name is required." }, 400);
  const role = body.role === "adult" ? "adult" : "child";

  await env.DB.prepare(`INSERT INTO people (id, name, role, avatar_emoji, theme_colour, counts_towards_reward, daily_task_count, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, avatar_emoji = excluded.avatar_emoji,
      theme_colour = excluded.theme_colour, counts_towards_reward = excluded.counts_towards_reward,
      daily_task_count = excluded.daily_task_count, active = excluded.active, sort_order = excluded.sort_order, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, String(body.name).trim(), role, body.avatar_emoji || "🦖", body.theme_colour || null,
      body.counts_towards_reward ? 1 : 0, Number(body.daily_task_count || 3), body.active === false ? 0 : 1, Number(body.sort_order || 99)).run();

  await log(env, { action_type: "person_saved", actor_name: "Parent", person_id: id, source: "admin", details: `Saved ${body.name}.` });
  return json({ ok: true, ...(await buildState(env)) });
}

async function saveTask(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);
  const id = cleanId(body.id || slug(body.title));
  if (!id || !body.title) return json({ ok: false, error: "Task title is required." }, 400);

  await env.DB.prepare(`INSERT INTO task_templates (id, title, icon, description, active, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, icon = excluded.icon, description = excluded.description,
      active = excluded.active, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, String(body.title).trim(), body.icon || "⭐", body.description || null, body.active === false ? 0 : 1).run();

  await log(env, { action_type: "task_saved", actor_name: "Parent", task_template_id: id, source: "admin", details: `Saved task ${body.title}.` });
  return json({ ok: true, ...(await buildState(env)) });
}

async function saveAssignment(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);
  const personId = cleanId(body.personId);
  const taskTemplateId = cleanId(body.taskTemplateId);
  if (!personId || !taskTemplateId) return json({ ok: false, error: "personId and taskTemplateId are required." }, 400);
  const id = `${personId}_${taskTemplateId}`;

  await env.DB.prepare(`INSERT INTO person_tasks (id, person_id, task_template_id, days_of_week, sort_order, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(person_id, task_template_id) DO UPDATE SET days_of_week = excluded.days_of_week,
      sort_order = excluded.sort_order, active = excluded.active, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, personId, taskTemplateId, body.days_of_week || "mon,tue,wed,thu,fri,sat,sun", Number(body.sort_order || 99), body.active === false ? 0 : 1).run();

  await log(env, { action_type: "assignment_saved", actor_name: "Parent", person_id: personId, task_template_id: taskTemplateId, source: "admin", details: "Task assignment saved." });
  return json({ ok: true, ...(await buildState(env)) });
}

async function saveScheduleDay(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);

  const personId = cleanId(body.personId);
  const taskDate = body.taskDate;
  const taskIds = Array.isArray(body.taskTemplateIds) ? body.taskTemplateIds.map(cleanId).filter(Boolean) : [];
  if (!personId || !isDate(taskDate)) return json({ ok: false, error: "personId and taskDate are required." }, 400);

  await saveScheduleForDay(env, personId, taskDate, taskIds);

  await log(env, {
    action_type: "schedule_day_saved",
    actor_name: "Parent",
    person_id: personId,
    task_date: taskDate,
    source: "admin",
    new_value: taskIds.join(","),
    details: "Daily task plan saved."
  });

  return json({ ok: true, ...(await buildState(env)) });
}

async function copyScheduleDay(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);

  const personId = cleanId(body.personId);
  const fromDate = body.fromDate;
  const toDates = Array.isArray(body.toDates) ? body.toDates.filter(isDate) : [];
  if (!personId || !isDate(fromDate) || !toDates.length) return json({ ok: false, error: "personId, fromDate and toDates are required." }, 400);

  const fromRows = await env.DB.prepare(
    `SELECT task_template_id FROM scheduled_tasks WHERE person_id = ? AND task_date = ? AND active = 1 ORDER BY sort_order`
  ).bind(personId, fromDate).all();
  const taskIds = (fromRows.results || []).map(r => r.task_template_id);

  for (const date of toDates) {
    await saveScheduleForDay(env, personId, date, taskIds);
  }

  await log(env, {
    action_type: "schedule_day_copied",
    actor_name: "Parent",
    person_id: personId,
    task_date: fromDate,
    source: "admin",
    new_value: toDates.join(","),
    details: "Daily task plan copied."
  });

  return json({ ok: true, ...(await buildState(env)) });
}

async function saveScheduleForDay(env, personId, taskDate, taskIds) {
  await env.DB.prepare(`UPDATE scheduled_tasks SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE person_id = ? AND task_date = ?`)
    .bind(personId, taskDate).run();

  const seen = new Set();
  let order = 1;
  for (const taskId of taskIds) {
    if (seen.has(taskId)) continue;
    seen.add(taskId);
    const exists = await env.DB.prepare(`SELECT 1 FROM task_templates WHERE id = ? AND active = 1`).bind(taskId).first();
    if (!exists) continue;

    const id = `${personId}_${taskDate}_${taskId}`;
    await env.DB.prepare(
      `INSERT INTO scheduled_tasks (id, person_id, task_date, task_template_id, sort_order, active, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(person_id, task_date, task_template_id)
       DO UPDATE SET sort_order = excluded.sort_order, active = 1, updated_at = CURRENT_TIMESTAMP`
    ).bind(id, personId, taskDate, taskId, order++).run();

    await env.DB.prepare(
      `INSERT INTO person_tasks (id, person_id, task_template_id, days_of_week, sort_order, active, updated_at)
       VALUES (?, ?, ?, 'mon,tue,wed,thu,fri,sat,sun', ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(person_id, task_template_id)
       DO UPDATE SET active = 1, updated_at = CURRENT_TIMESTAMP`
    ).bind(`${personId}_${taskId}`, personId, taskId, order).run();
  }
}

async function resetWeek(request, env) {
  const body = await readJson(request);
  if (!(await verifyPin(env, body.pin))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);
  const today = getUKDate();
  const weekStart = body.weekStartDate && isDate(body.weekStartDate) ? body.weekStartDate : getWeekStart(today);
  const weekEnd = addDays(weekStart, 6);
  await env.DB.prepare(`UPDATE task_completions SET completed = 0, updated_at = CURRENT_TIMESTAMP WHERE task_date BETWEEN ? AND ?`)
    .bind(weekStart, weekEnd).run();
  await log(env, { action_type: "week_reset", actor_name: "Parent", source: "admin", old_value: weekStart, new_value: weekEnd, details: "Current week completions reset." });
  return json({ ok: true, ...(await buildState(env)) });
}

async function activityLog(request, env) {
  const url = new URL(request.url);
  if (!(await verifyPin(env, url.searchParams.get("pin")))) return json({ ok: false, error: "Incorrect parent PIN." }, 401);
  const rows = await env.DB.prepare(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100`).all();
  return json({ ok: true, logs: rows.results || [] });
}

async function ensureWeeklyRewards(env, weekStartDate, settings) {
  const people = await env.DB.prepare(`SELECT id, counts_towards_reward FROM people WHERE active = 1 AND role = 'child'`).all();
  for (const p of people.results || []) {
    await env.DB.prepare(`INSERT OR IGNORE INTO weekly_rewards (id, person_id, week_start_date, reward_text, target_stars)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(`${p.id}_${weekStartDate}`, p.id, weekStartDate, settings.current_reward_text || "Reward chest surprise", p.counts_towards_reward ? Number(settings.default_weekly_target || 15) : 0).run();
  }
}

async function allTaskTemplates(env) {
  const rows = await env.DB.prepare(`SELECT * FROM task_templates WHERE active = 1 ORDER BY title`).all();
  return rows.results || [];
}

async function getSettings(env) {
  const rows = await env.DB.prepare(`SELECT key, value FROM settings`).all();
  const out = {};
  for (const row of rows.results || []) out[row.key] = row.value;
  return out;
}

async function verifyPin(env, pin) {
  if (!pin) return false;
  const settings = await getSettings(env);
  return await sha256(String(pin)) === settings.admin_pin_hash;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

async function log(env, row) {
  await env.DB.prepare(`INSERT INTO activity_log (id, action_type, actor_name, person_id, task_template_id, task_date, old_value, new_value, source, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), row.action_type, row.actor_name || null, row.person_id || null, row.task_template_id || null,
      row.task_date || null, row.old_value || null, row.new_value || null, row.source || null, row.details || null).run();
}

function getUKDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function getWeekStart(dateStr) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(dateStr, diff);
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function slug(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cleanId(value) {
  const v = String(value || "").trim();
  return /^[a-zA-Z0-9_-]+$/.test(v) ? v : "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}
