create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any prior schedule with this name to keep things idempotent.
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'refresh-project-overviews';
  if jid is not null then perform cron.unschedule(jid); end if;
end $$;

select cron.schedule(
  'refresh-project-overviews',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://project--9fa87df8-7e17-44bc-8d0a-b1b8ef2d6368.lovable.app/api/public/hooks/refresh-overviews',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);