
CREATE TABLE public.status_report_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly','biweekly','monthly')),
  day_of_week SMALLINT NOT NULL DEFAULT 5 CHECK (day_of_week BETWEEN 0 AND 6),
  hour_utc SMALLINT NOT NULL DEFAULT 14 CHECK (hour_utc BETWEEN 0 AND 23),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client','both')),
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_status_update_id UUID,
  last_error TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_schedules_next ON public.status_report_schedules(next_run_at) WHERE active = true;

ALTER TABLE public.status_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage status schedules"
ON public.status_report_schedules FOR ALL
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER trg_status_schedules_updated
BEFORE UPDATE ON public.status_report_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper to compute the next run at or after a given timestamp
CREATE OR REPLACE FUNCTION public.compute_next_status_run(
  _from TIMESTAMPTZ,
  _cadence TEXT,
  _day_of_week SMALLINT,
  _hour_utc SMALLINT
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base TIMESTAMPTZ;
  dow INT;
  diff INT;
BEGIN
  base := date_trunc('hour', _from) + make_interval(hours => 0);
  base := date_trunc('day', _from) + make_interval(hours => _hour_utc);
  dow := EXTRACT(DOW FROM base)::int;
  diff := (_day_of_week - dow + 7) % 7;
  IF diff = 0 AND base <= _from THEN
    diff := CASE _cadence
      WHEN 'weekly' THEN 7
      WHEN 'biweekly' THEN 14
      WHEN 'monthly' THEN 28
      ELSE 7
    END;
  END IF;
  RETURN base + make_interval(days => diff);
END;
$$;

-- Schedule hourly cron job to invoke the runner endpoint
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'status-reports-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9fa87df8-7e17-44bc-8d0a-b1b8ef2d6368.lovable.app/api/public/status-reports/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6c3FmYWZ0c3RtbmJ6YnBid3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTA2MzMsImV4cCI6MjA5MzQ4NjYzM30.jEyu3LaMnsPOnurKPXsihLyW1qkrcBVtO68UIxpaF7g'
    ),
    body := '{}'::jsonb
  );
  $$
);
