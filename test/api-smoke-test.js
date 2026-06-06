// Simple live API smoke test.
// Usage: DINO_STARS_URL=https://your-project.pages.dev node test/api-smoke-test.js

const base = process.env.DINO_STARS_URL;
if (!base) {
  console.error("Set DINO_STARS_URL first, for example: DINO_STARS_URL=https://dino-stars.pages.dev node test/api-smoke-test.js");
  process.exit(1);
}

async function main() {
  const health = await get("/api/health");
  assert(health.ok, "health ok");
  assert(health.app, "health includes app name");
  assert(health.version === "v1.2.0", "health shows v1.2.0");

  const state = await get("/api/state");
  assert(state.ok, "state ok");
  assert(Array.isArray(state.people) && state.people.length >= 4, "people loaded");
  assert(state.people.some(p => p.id === "george"), "George exists");
  assert(state.today, "today returned");
  assert(state.weekStartDate, "weekStartDate returned");
  assert(state.taskTemplates.some(t => t.id === "eat_all_dinner"), "new task library loaded");
  assert(state.taskTemplates.some(t => t.id === "brush_teeth" && t.icon === "🪥"), "single brush teeth task loaded");
  assert(state.tasksByPersonByDate.george[state.today].length >= 3, "George has tasks today");

  console.log("✅ Dino Stars smoke test passed");
}

async function get(path) {
  const res = await fetch(`${base}${path}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`${path} did not return JSON: ${text.slice(0, 120)}`); }
}

function assert(value, message) {
  if (!value) throw new Error(`Failed: ${message}`);
  console.log(`✓ ${message}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
