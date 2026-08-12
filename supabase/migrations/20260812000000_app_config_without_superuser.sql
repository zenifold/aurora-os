-- Move the callback origin out of a database GUC and into a table.
--
-- 20260811000000_repoint_lovable_callbacks.sql had the two cron jobs and
-- public.emit_agent_event read current_setting('app.base_url') /
-- current_setting('app.anon_key'), set with:
--
--   alter database postgres set app.base_url = '...';
--
-- That cannot work on hosted Supabase. `app.*` is a placeholder GUC, and
-- PostgreSQL only lets a superuser set placeholders via ALTER DATABASE or ALTER
-- ROLE. The hosted `postgres` role has rolsuper = false, so the statement fails
-- with 42501 permission denied — from the SQL editor and the Management API
-- alike. The result was silent: the settings stayed NULL, net.http_post received
-- a NULL url, and all three callbacks were permanently inert with no error.
--
-- public.app_config is ordinary table data, so it needs no elevated rights:
--
--   insert into public.app_config (key, value) values
--     ('base_url', 'https://aurora-app.work'),
--     ('anon_key', '<publishable key>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- Local Docker stack reaches the host through host.docker.internal:
--   ('base_url', 'http://host.docker.internal:5173')

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_config is
  'Deployment-scoped settings read by database callbacks. Replaces app.* GUCs, '
  'which require superuser to set and therefore cannot be used on hosted Supabase.';

-- RLS on with no policies: only roles that bypass it (postgres, service_role)
-- can read. anon/authenticated must never see anon_key or future secrets.
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

create or replace function public.app_config_get(_key text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v text;
begin
  select value into v from public.app_config where key = _key;
  if v is not null and v <> '' then
    return v;
  end if;
  -- Fall back to the old GUC so self-hosted installs that already set it (and
  -- have the superuser rights to) keep working with no changes.
  return nullif(current_setting('app.' || _key, true), '');
end
$fn$;

-- SECURITY DEFINER, so keep it off the public grant.
revoke all on function public.app_config_get(text) from public;
grant execute on function public.app_config_get(text) to postgres, service_role;

-- ─── Scheduled jobs ─────────────────────────────────────────────────────────
-- Unchanged behaviour when unset: app_config_get returns NULL, `NULL || text`
-- is NULL, net.http_post gets a NULL url and does nothing. Dormant still beats
-- firing at a stale host.
DO $do$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job
     WHERE jobname IN ('refresh-project-overviews', 'status-reports-hourly')
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END
$do$;

SELECT cron.schedule(
  'refresh-project-overviews',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := public.app_config_get('base_url') || '/api/public/hooks/refresh-overviews',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- The route authenticates on the `apikey` header, not a bearer token.
SELECT cron.schedule(
  'status-reports-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := public.app_config_get('base_url') || '/api/public/status-reports/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', public.app_config_get('anon_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ─── Agent event dispatcher ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emit_agent_event(
  _workspace_id uuid, _event_name text, _payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.agent_event_log (workspace_id, event_name, payload)
  VALUES (_workspace_id, _event_name, COALESCE(_payload, '{}'::jsonb))
  RETURNING id INTO log_id;

  PERFORM net.http_post(
    url := public.app_config_get('base_url') || '/api/public/hooks/agent-events/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', public.app_config_get('anon_key')
    ),
    body := jsonb_build_object(
      'log_id', log_id,
      'workspace_id', _workspace_id,
      'event_name', _event_name,
      'payload', COALESCE(_payload, '{}'::jsonb)
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block the originating transaction if pg_net is hiccupping.
  NULL;
END
$fn$;
