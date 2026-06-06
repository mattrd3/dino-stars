# Dino Stars v1.0.0

A mobile-first Progressive Web App for a child-friendly jobs, good deeds and reward chart.

Built for:

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- PWA installation on phone/tablet home screen

## What is included

- Dino jungle theme
- App-like PWA shell
- Home-screen manifest
- Service worker
- Offline page
- Mobile bottom navigation
- Today screen
- Week screen
- Reward chest screen
- Family screen
- Parent setup area
- Parent PIN
- Configurable app name
- Configurable reward text
- Configurable weekly target
- Configurable daily task count per person
- Configurable people
- Configurable tasks
- D1-backed shared status across devices
- Activity logging from day one

## Initial defaults

- App name: Dino Stars
- Theme: Dino jungle
- Parent PIN: 2468
- People: George, Charlotte, Mum, Dad
- George counts towards reward
- Adults do not count towards George's reward
- Default daily task count: 3
- Default weekly target: 15
- Week: Monday to Sunday
- Reset/day change: UK date logic via API

## Files

```text
public/index.html
public/styles.css
public/app.js
public/manifest.json
public/service-worker.js
public/offline.html
public/icons/*
functions/api/[[path]].js
migrations/0001_initial_schema.sql
test/api-smoke-test.js
test/pwa-checklist.md
wrangler.toml
package.json
```

## Setup steps

### 1. Create GitHub repo

Create a new repo, for example:

```bash
dino-stars
```

Copy all files from this folder into the repo and commit them.

### 2. Install dependencies locally

```bash
npm install
```

### 3. Create the D1 database

```bash
npx wrangler d1 create dino-stars-db
```

Cloudflare will return a database ID.

### 4. Update `wrangler.toml`

Open `wrangler.toml` and replace:

```text
PASTE_REAL_D1_DATABASE_ID_HERE
```

with the real D1 database ID returned by Cloudflare.

Important: once this is real, do not overwrite `wrangler.toml` casually.

### 5. Apply the database migration

```bash
npx wrangler d1 migrations apply dino-stars-db --remote
```

This creates the tables and inserts the starter Dino Stars data.

### 6. Create the Cloudflare Pages project

In Cloudflare:

1. Workers & Pages
2. Create application
3. Pages
4. Connect to Git
5. Select the Dino Stars repo
6. Framework preset: None
7. Build command: leave blank or use `npm install` only if Cloudflare asks
8. Output directory: `public`

### 7. Add D1 binding in Cloudflare Pages

In the Pages project:

1. Settings
2. Functions
3. Bindings
4. Add D1 database binding
5. Variable name: `DB`
6. Database: `dino-stars-db`
7. Add for Production
8. Add for Preview too if you want preview deployments to work

### 8. Deploy

Push to GitHub. Cloudflare Pages should deploy automatically.

### 9. Test health endpoint

Visit:

```text
https://your-project.pages.dev/api/health
```

Expected response includes:

```json
{
  "ok": true,
  "app": "Dino Stars",
  "version": "v1.0.0",
  "db": "connected"
}
```

### 10. Test app state

Visit:

```text
https://your-project.pages.dev/api/state
```

You should see George, Charlotte, Mum, Dad and today's tasks.

### 11. Run optional smoke test

```bash
DINO_STARS_URL=https://your-project.pages.dev node test/api-smoke-test.js
```

## Parent PIN

Initial PIN is:

```text
2468
```

Change it in Parent Setup after first deployment.

## PWA installation

### Android / Chrome

Open the app URL. Chrome should offer installation, or use the install button inside Parent Setup when available.

### iPhone / iPad

Open the app in Safari, tap Share, then Add to Home Screen.

## Versioning

Current version:

```text
v1.0.0
```

The version is used in:

- frontend app.js
- service worker cache name
- API health response
- settings seed

When releasing future versions, update all version references together.

## Notes from the Weekend Golf app lessons

- All completion state is stored in D1.
- Activity logging is built in from the first migration.
- D1 uniqueness prevents duplicate task completions from double taps.
- Admin tools are separated from child mode.
- PWA caching avoids caching API state aggressively, so devices should not show stale stars.
- `wrangler.toml` uses a placeholder ID to avoid accidental database overwrite.
