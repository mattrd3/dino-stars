# Dino Stars v1.1.0

Dino Stars is a PWA-first family reward chart for jobs and good things, built with:

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- Progressive Web App manifest/service worker

## v1.1 changes

This release includes the requested changes as one release:

1. Better dinosaur egg visuals: green eggs with white spots and small variations.
2. Cleaned task library:
   - Eat all dinner — 🍽️
   - Brush teeth — 🪥
   - Be polite — 🙂
   - Make your bed — 🛏️
   - Get dressed — 👕
   - Eat lunch at school — 🥪
   - Read a book — 📚
   - Learn your words — 🔤
   - Tidy up — 🧸
3. Weekly Planner in Parent Setup.
4. Exact day-by-day task selection for each person.
5. Planned days override fallback tasks.
6. Fallback recurring tasks remain in place so the app still works if a day has not been planned.
7. Version bumped to v1.1.0.

## Important deployment note

For an existing v1.0 database, apply the new migration before relying on the v1.1 Weekly Planner:

```bash
npx wrangler d1 migrations apply dino-stars-db --remote
```

This applies:

```text
migrations/0002_v1_1_weekly_planner.sql
```

The migration creates the new `scheduled_tasks` table and updates the task library.

## Existing deployment flow

1. Copy these files into your existing `dino-stars` repo.
2. Do not overwrite your real `wrangler.toml` database ID accidentally.
3. Commit and push to GitHub.
4. Apply the D1 migration:

```bash
npx wrangler d1 migrations apply dino-stars-db --remote
```

5. Wait for Cloudflare Pages to deploy.
6. Check:

```text
https://dino-stars.pages.dev/api/health
```

Expected:

```json
{
  "ok": true,
  "app": "Dino Stars",
  "version": "v1.1.0",
  "db": "connected"
}
```

## Using the Weekly Planner

In the app:

1. Go to Parent.
2. Enter the parent PIN.
3. Open Weekly Planner.
4. Choose the person.
5. For each day, choose the tasks in the dropdown slots.
6. Tap Save for that day.
7. Use Copy to all days if you want the same set across the week.

The number of task slots shown is controlled by that person's `Daily task count`.

## Smoke test

PowerShell:

```powershell
$env:DINO_STARS_URL="https://dino-stars.pages.dev"; node test/api-smoke-test.js
```

Expected:

```text
✅ Dino Stars smoke test passed
```
