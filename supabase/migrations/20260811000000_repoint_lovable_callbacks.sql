-- Repoint the Lovable-era database callbacks at whatever origin is running the
-- app, and stop embedding the Supabase anon key in object definitions.
--
-- Three objects created by earlier migrations hardcoded the Lovable preview
-- deployment (project--9fa87df8-….lovable.app) and, in two cases, the anon key:
--   * cron job  refresh-project-overviews
--   * cron job  status-reports-hourly
--   * function  public.emit_agent_event
--
-- They now read two database settings at call time, so the same migration works
-- for local, staging, and production without edits. Set them per environment:
--
--   alter database postgres set app.base_url = 'https://your-domain';
--   alter database postgres set app.anon_key = '<publishable/anon key>';
--
-- Local Docker stack (Postgres reaches the host through host.docker.internal):
--   alter database postgres set app.base_url = 'http://host.docker.internal:8080';
--
-- If app.base_url is unset, current_setting(..., true) returns NULL, net.http_post
-- is passed a NULL url and does nothing. The callbacks stay dormant rather than
-- firing at a stale host, which is the desired failure mode.

-- ─── Scheduled jobs ─────────────────────────────────────────────────────────
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
    url := current_setting('app.base_url', true) || '/api/public/hooks/refresh-overviews',
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
    url := current_setting('app.base_url', true) || '/api/public/status-reports/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.anon_key', true)
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
    url := current_setting('app.base_url', true) || '/api/public/hooks/agent-events/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.anon_key', true)
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

-- ─── Retire the "lovable" AI provider ───────────────────────────────────────
-- The app now talks to OpenRouter everywhere; "lovable" is not a provider it
-- can route to, and google/gemini-3-flash-preview is not a slug OpenRouter
-- reliably serves.
ALTER TABLE public.ai_agents
  ALTER COLUMN model_config
  SET DEFAULT '{"provider":"openrouter","model":"google/gemini-2.5-flash","temperature":0.3}'::jsonb;

UPDATE public.ai_agents
   SET model_config = jsonb_set(
         jsonb_set(model_config, '{provider}', '"openrouter"'),
         '{model}', '"google/gemini-2.5-flash"')
 WHERE model_config->>'provider' = 'lovable';
