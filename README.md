# Dino Stars v1.3.0

Dino Stars is a PWA-first family reward chart for jobs and good things, built with Cloudflare Pages, Pages Functions and D1.

## v1.3 changes

This release includes:

1. Reward chest reveal behaviour:
   - Parent/admin pre-selects the weekly reward.
   - George sees a locked/mystery reward while still collecting stars.
   - When the weekly target is reached, the chest opens and the selected reward is revealed.
2. Simplified green eggs:
   - Reverts away from the spotted eggs.
   - Uses a cleaner green egg style that is closer to the original, but green.
3. Version bumped to v1.3.0.
4. New migration: `0004_v1_3_reward_reveal_and_green_eggs.sql`.

## Reward setup

In Parent Setup:

1. Open Weekly Reward.
2. Choose the reward person, for example George.
3. Enter the reward text, for example `Soft play`.
4. Enter the stars needed for the week, for example `15`.
5. Save weekly reward.

George will not see the reward text until the reward chest is unlocked.

## Deployment

Copy the files into your existing `dino-stars` repo.

Important: do not overwrite your real `wrangler.toml` database ID. This package includes a `wrangler.toml` only for completeness, but you should normally keep your existing working one.

Apply migrations:

```powershell
npx wrangler d1 migrations apply dino-stars-db --remote
```

For an existing v1.2 database this should apply:

```text
0004_v1_3_reward_reveal_and_green_eggs.sql
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
  "version": "v1.3.0",
  "db": "connected"
}
```

## Smoke test

PowerShell:

```powershell
$env:DINO_STARS_URL="https://dino-stars.pages.dev"; node test/api-smoke-test.js
```

Because this is a PWA, hard refresh after deployment and close/reopen the installed app on mobile.
