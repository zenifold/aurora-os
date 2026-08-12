# Local development

Runs the app against a local Supabase stack in Docker. No cloud project, no
Lovable, safe to wipe and re-seed.

## Prerequisites

- Node 20+ (developed on 24) and Docker Desktop **running**
- No global Supabase CLI needed — it is a devDependency, so `npx supabase` works

## Start

```bash
npm install
npx supabase start     # first run pulls ~3GB of images; later runs take seconds
npm run dev            # http://localhost:5173 — takes ~55s to boot; wait for "ready in …"
```

`supabase start` applies all migrations in `supabase/migrations/` on first init.

| Service | URL |
|---------|-----|
| App | http://localhost:5173 (override with `PORT=8090 npm run dev`) |
| Supabase API | http://127.0.0.1:54321 |
| Studio (table editor, SQL) | http://127.0.0.1:54323 |
| Mailpit (catches every outbound email) | http://127.0.0.1:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

`.env` is already pointed at this stack. Its keys are the CLI's fixed local demo
keys — identical on every machine and worthless against a real project.

## One-time settings for the database callbacks

Two `pg_cron` jobs and `emit_agent_event` need to know where the app lives.
Postgres reaches your host through `host.docker.internal`:

The local container is named after `project_id` in `supabase/config.toml`, so
substitute your own ref (it changes whenever you `supabase link`):

```bash
docker exec -i supabase_db_<project_id> psql -U postgres -d postgres -c \
  "insert into public.app_config (key, value) values \
     ('base_url', 'http://host.docker.internal:5173') \
   on conflict (key) do update set value = excluded.value, updated_at = now();"
```

Because the container name is derived from `project_id`, linking to a different
project makes `supabase start` create a *fresh, empty* local stack — the previous
one keeps its data under the old name.

Add an `anon_key` row the same way, using the local anon key from
`npx supabase status`. These are plain table rows, so `postgres` is sufficient —
no `supabase_admin` and no `ALTER DATABASE`. See
[de-lovable-db.md](de-lovable-db.md).

## Everyday commands

```bash
npm run dev            # dev server on :5173
npm run typecheck      # tsc --noEmit
npm run build          # production build (Cloudflare Workers output in dist/)
npm run format         # prettier; the tree has a large pre-existing backlog
npx supabase status    # URLs and keys
npx supabase stop      # stop the stack (data survives)
npx supabase db reset  # wipe and replay every migration
```

## Creating a user

Signups are auto-confirmed locally and every email is caught by Mailpit, so
sign up at http://localhost:5173/signup and read any confirmation mail at
http://127.0.0.1:54324. Google OAuth will *not* work locally unless you
configure a Google provider in `supabase/config.toml`; email/password does.

## Gotchas found while setting this up

- **Port is 8080**, not the 3000 some older docs claimed.
- **`realtime.messages` RLS**: migration `20260523233213_*` enables RLS and adds
  policies on `realtime.messages`, which is owned by `supabase_admin`. Locally the
  migration role does not own it, so Postgres raises `insufficient_privilege` and
  aborted `supabase start` at migration 145 of 145. Those statements are now
  wrapped in an exception handler that skips with a notice locally and still
  applies on hosted Supabase.
- **`npm run build` needs `cross-env`** — the original `NODE_OPTIONS=…` prefix is
  POSIX-only and fails on Windows.
- **AI features** stay disabled until `OPENROUTER_API_KEY` is set in `.env`, or a
  workspace owner pastes a key in Settings → AI (stored per-workspace in
  `workspace_ai_secrets`, which takes precedence).
- **The `vector` container crash-loops on Docker Desktop for Windows.** It cannot
  reach the Docker socket (`ConnectionRefused` listing containers), so it restarts
  forever. It only ships container logs to Studio's *Logs* viewer — Postgres,
  auth, REST, storage, realtime, and Studio itself are unaffected. To stop the
  noise and save three containers, disable analytics in `supabase/config.toml`:

  ```toml
  [analytics]
  enabled = false
  ```
