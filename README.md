# Strength & Nutrition Tracker (Built With Science+ recreation, in progress)

A mobile-first web app (React + TypeScript + IndexedDB) that implements the documented
behaviour of Built With Science+: dashboard calendar and checklist, weekly workout
scheduling with drag-to-move, the Workout Library, supersets, rest timers with saved
overrides, previous-week progression cues, the food log with meals, custom foods,
quick add and scanning, the Nutrition Check-In, progress views, and an AI coach.

**This is not a visual replica.** No reference screenshots or recordings were available.
See [`docs/PARITY.md`](docs/PARITY.md) for what is verified, what is assumed, and what is
missing.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 (UI only; /api is proxied to :8787)
npm start            # app server on :8787: serves dist/ and the AI endpoints
npm run build        # typecheck + production build
npm test             # unit tests (vitest)
npm run e2e          # journey tests (Playwright, 390×844)
```

AI features (the coach, meal-photo and text food estimates) need `ANTHROPIC_API_KEY` set
for `npm start`. Without it, the app shows a "not configured" state.

## Accounts and sync (Supabase)

Sign-in uses Supabase Auth (email + password). Every local change is recorded and
synced to `public.sync_rows` (one row per record, newest edit wins), so the same
account sees the same data on phone and PC. The app still works offline and catches up
when it reconnects. Row-level security limits each account to its own rows. Progress
photos stay on the device they were taken on.

The project URL and publishable key live in `src/sync/supabase.ts` (override with
`VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY`). Schema:

```sql
create table public.sync_rows (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tbl text not null, pk text not null, data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),   -- bumped by trigger on every write
  primary key (user_id, tbl, pk)
);
-- RLS on; select/insert/update/delete only where auth.uid() = user_id; added to supabase_realtime.
```

## Deploy to GitHub Pages

`.github/workflows/pages.yml` builds and publishes on every push to `main` or
`claude/hopeful-einstein-4n1gtd`. One-time setup: **Settings → Pages → Build and deployment
→ Source: GitHub Actions**. The site appears at `https://<user>.github.io/<repo>/`. Pages
can't run the AI server, so the coach and food estimates show "not available" there.

## Deploy to Netlify

`netlify.toml` sets everything: build `npm run build`, publish `dist`, and Node 22.
`public/_redirects` sends every app route (e.g. `/onboarding`) to `index.html`.
`netlify/functions/api.mjs` serves `/api/*`. To turn on the AI coach and food estimates, add
`ANTHROPIC_API_KEY` under Site configuration → Environment variables and redeploy.

## Layout

- `src/db`: Dexie schema (`types.ts` is the full persistent data model) and generic seed content
- `src/domain`: progression, schedule versioning, supersets, sessions, nutrition, check-in
- `src/screens`, `src/components`: UI. Visual tokens are in `src/styles.css` and are provisional
- `server/coach-server.mjs`: static hosting plus the Claude-backed `/api/coach` and `/api/food/estimate`
- `tests/unit`, `tests/e2e`: tests. `docs/screenshots` holds implementation captures
