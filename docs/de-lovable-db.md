# Database: Lovable callbacks and how they were repointed

Earlier migrations baked the Lovable preview deployment
(`project--9fa87df8-….lovable.app`) into three database objects, and embedded the
Supabase anon key in two of them. Migration
`20260811000000_repoint_lovable_callbacks.sql` replaces all of it with two
runtime settings, so one migration works for local, staging, and production.

| Object | Was | Now |
|--------|-----|-----|
| `cron.job` `refresh-project-overviews` (`15 * * * *`) | hardcoded Lovable URL | `current_setting('app.base_url')` |
| `cron.job` `status-reports-hourly` (`7 * * * *`) | hardcoded URL + anon key | `current_setting('app.base_url')` + `app.anon_key` |
| `public.emit_agent_event(uuid, text, jsonb)` | hardcoded URL + anon key | same two settings |
| `public.ai_agents.model_config` default | `{"provider":"lovable","model":"google/gemini-3-flash-preview",…}` | `{"provider":"openrouter","model":"google/gemini-2.5-flash",…}` |

The earlier migrations that created these objects were left untouched — they have
already run against the Lovable-hosted project, so they are history. The fix is
additive.

## Required settings

Both callbacks read their target at call time. **They are inert until you set
these**, which is deliberate: if `app.base_url` is unset,
`current_setting(…, true)` returns NULL, `net.http_post` receives a NULL url, and
nothing fires. Dormant beats firing at a stale host.

Set them as rows in `public.app_config` — ordinary table data, so no elevated
privileges are involved:

```sql
insert into public.app_config (key, value) values
  ('base_url', 'https://your-domain'),
  ('anon_key', '<anon / publishable key>')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

For the local Docker stack, Postgres reaches the host through
`host.docker.internal`:

```sql
insert into public.app_config (key, value) values
  ('base_url', 'http://host.docker.internal:5173')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

Read on every call, so `pg_cron` picks up a change on its next tick.

> **Why a table and not `alter database … set app.base_url`?** Earlier revisions
> of this doc said to use a database GUC. That cannot work on hosted Supabase:
> `app.*` is a *placeholder* GUC, and PostgreSQL only lets a **superuser** set
> placeholders via `ALTER DATABASE`/`ALTER ROLE`. Hosted Supabase's `postgres`
> role has `rolsuper = false`, so it fails with `42501 permission denied` — from
> the dashboard SQL editor and the Management API alike. Worse, the failure was
> silent in effect: the settings stayed NULL and all three callbacks were
> permanently dormant with nothing logged.
> `20260812000000_app_config_without_superuser.sql` moved them to a table.
> `public.app_config_get()` still falls back to the old GUC, so self-hosted
> installs that already set it keep working untouched.

`app_config` has RLS enabled with no policies and no grants to `anon` or
`authenticated`: only `service_role` and `postgres` can read it, since it holds
the anon key today and may hold real secrets later.

## Verifying

```sql
select public.app_config_get('base_url');
select jobname, schedule, command from cron.job;
select position('lovable' in prosrc) from pg_proc where proname = 'emit_agent_event';  -- expect 0
select column_default from information_schema.columns
 where table_name = 'ai_agents' and column_name = 'model_config';
```

## Note on the anon key

The `.env` inside the Lovable export carried the URL and anon key for the
Lovable-hosted project, and that same `.env` is committed on this repo's `main`
branch (the Lovable-synced history). The anon key is designed to be public and is
constrained by RLS, so this is not urgent — but rotate it if you stop using that
project, and note the key also sat inside two database object definitions until
the migration above removed it.
