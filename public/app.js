const APP_VERSION = "v1.0.0";
const THEMES = {
  dino_jungle: {
    eggIcon: "🥚",
    completeIcon: "⭐",
    heroIcon: "🦖",
    completeMessage: "Dino star collected!",
    dailyMessage: "All jobs done! Dino dance time!",
    rewardMessage: "Reward chest unlocked! Dino conga!"
  }
};

let state = null;
let selectedPersonId = localStorage.getItem("dinoStarsSelectedPerson") || "george";
let selectedTask = null;
let adminPin = sessionStorage.getItem("dinoStarsAdminPin") || "";
let deferredInstallPrompt = null;

const $ = (id) => document.getElementById(id);

window.addEventListener("DOMContentLoaded", async () => {
  bindNavigation();
  bindControls();
  registerServiceWorker();
  await loadState();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = $("installBtn");
  if (btn) btn.disabled = false;
});

window.addEventListener("online", () => setOffline(false));
window.addEventListener("offline", () => setOffline(true));

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("/service-worker.js"); } catch (err) { console.warn("SW registration failed", err); }
  }
}

function bindNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showScreen(btn.dataset.screen));
  });
}

function bindControls() {
  $("refreshBtn").addEventListener("click", loadState);
  $("unlockBtn").addEventListener("click", unlockAdmin);
  $("saveSettingsBtn").addEventListener("click", saveSettings);
  $("addPersonBtn").addEventListener("click", addPersonPrompt);
  $("addTaskBtn").addEventListener("click", addTaskPrompt);
  $("undoSelectedBtn").addEventListener("click", undoSelectedTask);
  $("resetWeekBtn").addEventListener("click", resetWeek);
  $("loadLogsBtn").addEventListener("click", loadLogs);
  $("installBtn").addEventListener("click", installApp);
}

async function loadState() {
  setOffline(!navigator.onLine);
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Could not load state");
    state = data;
    if (!state.people.find(p => p.id === selectedPersonId)) selectedPersonId = state.people[0]?.id || "george";
    render();
    $("loadingScreen").classList.add("hidden");
  } catch (err) {
    console.error(err);
    setOffline(true);
    $("loadingScreen").innerHTML = `<div class="big-dino">🦖</div><h2>Could not reach the Dino jungle</h2><p>${escapeHtml(err.message || "Check connection and D1 setup.")}</p>`;
  }
}

function render() {
  if (!state) return;
  document.title = state.settings.app_name || "Dino Stars";
  $("appName").textContent = state.settings.app_name || "Dino Stars";
  $("versionLabel").textContent = `${APP_VERSION} / API ${state.version || "unknown"}`;
  document.body.className = `theme-${state.settings.theme || "dino_jungle"}`;
  renderPeopleStrip();
  renderToday();
  renderWeek();
  renderReward();
  renderFamily();
  renderAdmin();
}

function renderPeopleStrip() {
  const strip = $("personStrip");
  strip.innerHTML = "";
  for (const person of state.people) {
    const btn = document.createElement("button");
    btn.className = `person-btn ${person.id === selectedPersonId ? "active" : ""}`;
    btn.innerHTML = `<span class="person-avatar">${escapeHtml(person.avatar_emoji)}</span>${escapeHtml(person.name)}`;
    btn.addEventListener("click", () => {
      selectedPersonId = person.id;
      localStorage.setItem("dinoStarsSelectedPerson", selectedPersonId);
      render();
    });
    strip.appendChild(btn);
  }
}

function renderToday() {
  const person = getSelectedPerson();
  if (!person) return;
  const tasks = getTasks(person.id, state.today);
  const completed = tasks.filter(t => t.completed).length;
  $("todayDateLabel").textContent = niceDate(state.today);
  $("todayTitle").textContent = `${person.name}’s Dino Jobs`;
  $("todayProgress").textContent = `${completed} / ${tasks.length || person.daily_task_count || 3}`;
  const list = $("taskList");
  list.innerHTML = "";

  if (!tasks.length) {
    list.innerHTML = `<div class="card"><h2>No tasks yet</h2><p class="muted">Add tasks in Parent Setup.</p></div>`;
    return;
  }

  for (const task of tasks) {
    const btn = document.createElement("button");
    btn.className = `task-card ${task.completed ? "completed" : ""}`;
    btn.innerHTML = `
      <div class="task-egg">${task.completed ? theme().completeIcon : theme().eggIcon}</div>
      <div>
        <div class="task-title">${escapeHtml(task.icon)} ${escapeHtml(task.title)}</div>
        <div class="task-sub">${task.completed ? "Star collected" : "Tap the egg when done"}</div>
      </div>`;
    btn.addEventListener("click", () => {
      selectedTask = { personId: person.id, taskTemplateId: task.taskTemplateId, taskDate: state.today };
      if (!task.completed) completeTask(person, task);
    });
    list.appendChild(btn);
  }
}

function renderWeek() {
  const person = getSelectedPerson();
  const progress = state.rewardProgress[person.id];
  $("weekTitle").textContent = `${person.name}’s Week`;
  $("weekSummary").textContent = `${progress.completedStars} / ${progress.targetStars || progress.possibleStars} stars collected${person.counts_towards_reward ? "" : " — family participation only"}`;
  const grid = $("weekGrid");
  grid.innerHTML = "";
  for (const date of state.weekDates) {
    const tasks = getTasks(person.id, date);
    const row = document.createElement("div");
    row.className = "day-row";
    const stars = tasks.map(t => t.completed ? theme().completeIcon : theme().eggIcon).join(" ") || "—";
    row.innerHTML = `<div><strong>${dayName(date)}</strong><div class="muted">${shortDate(date)}</div></div><div class="day-stars">${stars}</div>`;
    grid.appendChild(row);
  }
}

function renderReward() {
  const person = getSelectedPerson();
  const progress = state.rewardProgress[person.id];
  $("rewardTitle").textContent = progress.rewardText || state.settings.current_reward_text || "Reward chest surprise";
  const pct = Math.min(100, progress.targetStars ? (progress.completedStars / progress.targetStars) * 100 : 0);
  $("rewardMeter").style.width = `${pct}%`;
  if (!person.counts_towards_reward) {
    $("rewardText").textContent = `${person.name} joins in, but does not count towards George’s score.`;
  } else if (progress.unlocked) {
    $("rewardText").textContent = `${progress.completedStars} / ${progress.targetStars} Dino Stars — reward unlocked!`;
  } else {
    const left = Math.max(0, progress.targetStars - progress.completedStars);
    $("rewardText").textContent = `${progress.completedStars} / ${progress.targetStars} Dino Stars. Collect ${left} more to open the chest.`;
  }
}

function renderFamily() {
  const list = $("familyList");
  list.innerHTML = "";
  for (const person of state.people) {
    const progress = state.rewardProgress[person.id];
    const row = document.createElement("div");
    row.className = "family-row";
    row.innerHTML = `<div><strong>${escapeHtml(person.avatar_emoji)} ${escapeHtml(person.name)}</strong><div class="muted">${person.role}${person.counts_towards_reward ? " · reward score counts" : " · joins in"}</div></div><div class="progress-pill">${progress.completedStars} ⭐</div>`;
    list.appendChild(row);
  }
}

function renderAdmin() {
  if (!state) return;
  $("settingAppName").value = state.settings.app_name || "Dino Stars";
  $("settingTheme").value = state.settings.theme || "dino_jungle";
  $("settingDailyCount").value = state.settings.default_daily_task_count || "3";
  $("settingWeeklyTarget").value = state.settings.default_weekly_target || "15";
  $("settingRewardText").value = state.settings.current_reward_text || "Reward chest surprise";
  renderPeopleEditor();
  renderTaskEditor();
  if (adminPin) {
    $("pinPanel").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
  }
}

function renderPeopleEditor() {
  const box = $("peopleEditor");
  box.innerHTML = "";
  for (const p of state.people) {
    const row = document.createElement("div");
    row.className = "editor-row";
    row.innerHTML = `
      <input value="${escapeAttr(p.avatar_emoji)}" data-field="avatar_emoji" data-id="${p.id}" aria-label="Avatar">
      <input value="${escapeAttr(p.name)}" data-field="name" data-id="${p.id}" aria-label="Name">
      <label class="checkbox-label full"><input type="checkbox" data-field="counts_towards_reward" data-id="${p.id}" ${p.counts_towards_reward ? "checked" : ""}> Counts towards reward</label>
      <label class="full">Daily task count <input type="number" min="1" max="8" value="${p.daily_task_count || 3}" data-field="daily_task_count" data-id="${p.id}"></label>
      <button class="secondary-btn full" data-save-person="${p.id}">Save ${escapeHtml(p.name)}</button>`;
    box.appendChild(row);
  }
  box.querySelectorAll("[data-save-person]").forEach(btn => btn.addEventListener("click", () => savePerson(btn.dataset.savePerson)));
}

function renderTaskEditor() {
  const box = $("taskEditor");
  box.innerHTML = "";
  for (const t of state.taskTemplates) {
    const row = document.createElement("div");
    row.className = "editor-row";
    row.innerHTML = `
      <input value="${escapeAttr(t.icon)}" data-task-field="icon" data-id="${t.id}" aria-label="Icon">
      <input value="${escapeAttr(t.title)}" data-task-field="title" data-id="${t.id}" aria-label="Task title">
      <button class="secondary-btn full" data-save-task="${t.id}">Save task</button>`;
    box.appendChild(row);
  }
  box.querySelectorAll("[data-save-task]").forEach(btn => btn.addEventListener("click", () => saveTask(btn.dataset.saveTask)));
}

async function completeTask(person, task) {
  if (!navigator.onLine) {
    setOffline(true);
    return;
  }
  const before = getTasks(person.id, state.today).filter(t => t.completed).length;
  const wasRewardUnlocked = state.rewardProgress[person.id]?.unlocked;
  try {
    const data = await post("/api/complete-task", { personId: person.id, taskTemplateId: task.taskTemplateId, taskDate: state.today, source: "child" });
    state = data;
    render();
    const afterTasks = getTasks(person.id, state.today);
    const after = afterTasks.filter(t => t.completed).length;
    const isAllDone = afterTasks.length > 0 && after === afterTasks.length && before !== after;
    const nowRewardUnlocked = state.rewardProgress[person.id]?.unlocked;
    if (nowRewardUnlocked && !wasRewardUnlocked) showCelebration(theme().rewardMessage, "🎁🦖⭐", true);
    else if (isAllDone) showCelebration(theme().dailyMessage, "🦖🪩⭐", true);
    else showCelebration(`${theme().completeMessage} Great job ${person.name}!`, "🦖👍");
  } catch (err) {
    alert(err.message);
  }
}

async function unlockAdmin() {
  const pin = $("pinInput").value.trim();
  try {
    const res = await post("/api/admin/check-pin", { pin });
    if (res.ok) {
      adminPin = pin;
      sessionStorage.setItem("dinoStarsAdminPin", pin);
      $("pinPanel").classList.add("hidden");
      $("adminPanel").classList.remove("hidden");
      showCelebration("Parent area unlocked", "🔒🦖");
    } else alert("Incorrect PIN");
  } catch (err) { alert(err.message); }
}

async function saveSettings() {
  try {
    const payload = {
      pin: adminPin,
      app_name: $("settingAppName").value,
      theme: $("settingTheme").value,
      default_daily_task_count: $("settingDailyCount").value,
      default_weekly_target: $("settingWeeklyTarget").value,
      current_reward_text: $("settingRewardText").value
    };
    if ($("settingNewPin").value.trim()) payload.new_pin = $("settingNewPin").value.trim();
    state = await post("/api/admin/settings", payload);
    $("settingNewPin").value = "";
    render();
    showCelebration("Settings saved", "🦖✅");
  } catch (err) { alert(err.message); }
}

async function savePerson(id) {
  const person = state.people.find(p => p.id === id);
  const q = (field) => document.querySelector(`[data-field="${field}"][data-id="${id}"]`);
  try {
    state = await post("/api/admin/person", {
      pin: adminPin,
      id,
      name: q("name").value,
      role: person.role,
      avatar_emoji: q("avatar_emoji").value,
      counts_towards_reward: q("counts_towards_reward").checked,
      daily_task_count: q("daily_task_count").value,
      sort_order: person.sort_order,
      active: true
    });
    render();
    showCelebration("Person saved", "🦖✅");
  } catch (err) { alert(err.message); }
}

async function saveTask(id) {
  const q = (field) => document.querySelector(`[data-task-field="${field}"][data-id="${id}"]`);
  try {
    state = await post("/api/admin/task", { pin: adminPin, id, icon: q("icon").value, title: q("title").value, active: true });
    render();
    showCelebration("Task saved", "⭐✅");
  } catch (err) { alert(err.message); }
}

async function addPersonPrompt() {
  const name = prompt("Person name");
  if (!name) return;
  const role = confirm("Is this an adult? Press OK for adult, Cancel for child.") ? "adult" : "child";
  try {
    state = await post("/api/admin/person", { pin: adminPin, name, role, avatar_emoji: role === "adult" ? "🦕" : "🦖", counts_towards_reward: false, daily_task_count: 3, active: true, sort_order: 99 });
    render();
  } catch (err) { alert(err.message); }
}

async function addTaskPrompt() {
  const title = prompt("Task name");
  if (!title) return;
  const icon = prompt("Emoji icon", "⭐") || "⭐";
  try {
    state = await post("/api/admin/task", { pin: adminPin, title, icon, active: true });
    render();
  } catch (err) { alert(err.message); }
}

async function undoSelectedTask() {
  if (!selectedTask) {
    alert("Tap a task on the Today screen first, then come back here to undo it.");
    return;
  }
  if (!confirm("Undo the selected task?")) return;
  try {
    state = await post("/api/undo-task", { pin: adminPin, ...selectedTask });
    render();
    showCelebration("Task undone", "↩️🦖");
  } catch (err) { alert(err.message); }
}

async function resetWeek() {
  if (!confirm("Reset all completions for this week?")) return;
  try {
    state = await post("/api/admin/reset-week", { pin: adminPin });
    render();
    showCelebration("Week reset", "🦖↩️");
  } catch (err) { alert(err.message); }
}

async function loadLogs() {
  try {
    const res = await fetch(`/api/admin/activity-log?pin=${encodeURIComponent(adminPin)}`, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Could not load logs");
    const list = $("logList");
    list.innerHTML = "";
    for (const log of data.logs) {
      const row = document.createElement("div");
      row.className = "log-row";
      row.innerHTML = `<time>${escapeHtml(formatDateTime(log.created_at))}</time><strong>${escapeHtml(log.action_type)}</strong><p class="muted">${escapeHtml(log.details || "")}</p>`;
      list.appendChild(row);
    }
  } catch (err) { alert(err.message); }
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("installBtn").disabled = true;
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
  $(`screen-${name}`).classList.add("active");
}

async function post(url, payload) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

function getSelectedPerson() { return state.people.find(p => p.id === selectedPersonId) || state.people[0]; }
function getTasks(personId, date) { return state.tasksByPersonByDate?.[personId]?.[date] || []; }
function theme() { return THEMES[state?.settings?.theme] || THEMES.dino_jungle; }
function setOffline(flag) { $("offlineBanner").classList.toggle("hidden", !flag); }
function niceDate(date) { return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`)); }
function shortDate(date) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`)); }
function dayName(date) { return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date(`${date}T12:00:00Z`)); }
function formatDateTime(value) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${String(value).replace(" ", "T")}Z`)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }

function showCelebration(message, emoji, disco = false) {
  const box = $("celebration");
  box.className = `celebration ${disco ? "disco" : ""}`;
  box.innerHTML = `<div class="confetti">${Array.from({ length: 42 }, (_, i) => `<i style="left:${Math.random()*100}%; animation-delay:${Math.random()*0.35}s; background:${["#ffcc4d", "#4caf50", "#81d4fa", "#f48fb1"][i%4]}"></i>`).join("")}</div><div class="celebration-card"><div class="celebration-emoji">${emoji}</div><h2>${escapeHtml(message)}</h2></div>`;
  setTimeout(() => box.classList.add("hidden"), 1800);
}
