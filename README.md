# Dino Stars v1.2.0

Dino Stars is a PWA-first family reward chart for jobs and good things, built with Cloudflare Pages, Pages Functions and D1.

## v1.2 changes

This release includes:

1. Weekly reward controls in Parent Setup:
   - choose reward person
   - set reward text
   - set stars needed for this week
2. More egg-like dinosaur egg visuals:
   - taller egg shape
   - green shell
   - white spots
   - small visual variants
3. App version moved to the top of the admin menu only.
4. API version bumped to v1.2.0.
5. New migration: `0003_v1_2_reward_admin_and_egg_polish.sql`.

## Previous v1.1 changes retained

- Clean task library:
  - Eat all dinner — 🍽️
  - Brush teeth — 🪥
  - Be polite — 🙂
  - Make your bed — 🛏️
  - Get dressed — 👕
  - Eat lunch at school — 🥪
  - Read a book — 📚
  - Learn your words — 🔤
  - Tidy up — 🧸
- Weekly Planner
- Exact day-by-day task selection
- `scheduled_tasks` table

## Deployment

Copy the files into your existing `dino-stars` repo.

Be careful with `wrangler.toml` and do not overwrite your real D1 database ID unless the file is correct.

Apply migrations:

```powershell
npx wrangler d1 migrations apply dino-stars-db --remote
```

For an existing v1.1 database this should apply:

```text
0003_v1_2_reward_admin_and_egg_polish.sql
```

Then commit and push to GitHub.

Check:

```text
https://dino-stars.pages.dev/api/health
```

Expected:

```json
{
  "ok": true,
  "app": "Dino Stars",
  "version": "v1.2.0",
  "db": "connected"
}
```

## Smoke test

PowerShell:

```powershell
$env:DINO_STARS_URL="https://dino-stars.pages.dev"; node test/api-smoke-test.js
```
