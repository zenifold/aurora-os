
-- ─── Event log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'system',
  dispatched_at timestamptz,
  triggers_matched int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_event_log_workspace_created
  ON public.agent_event_log(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_event_log_event_name
  ON public.agent_event_log(workspace_id, event_name, created_at DESC);

ALTER TABLE public.agent_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view event log"
  ON public.agent_event_log FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- ─── Dispatcher helper ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emit_agent_event(_workspace_id uuid, _event_name text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.agent_event_log (workspace_id, event_name, payload)
  VALUES (_workspace_id, _event_name, COALESCE(_payload, '{}'::jsonb))
  RETURNING id INTO log_id;

  PERFORM net.http_post(
    url := 'https://project--9fa87df8-7e17-44bc-8d0a-b1b8ef2d6368.lovable.app/api/public/hooks/agent-events/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6c3FmYWZ0c3RtbmJ6YnBid3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTA2MzMsImV4cCI6MjA5MzQ4NjYzM30.jEyu3LaMnsPOnurKPXsihLyW1qkrcBVtO68UIxpaF7g'
    ),
    body := jsonb_build_object(
      'log_id', log_id,
      'workspace_id', _workspace_id,
      'event_name', _event_name,
      'payload', COALESCE(_payload, '{}'::jsonb)
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block the originating transaction if pg_net is hiccupping
  NULL;
END;
$$;

-- ─── Project status change ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.projects_emit_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.emit_agent_event(
      NEW.workspace_id,
      'project.status_changed',
      jsonb_build_object(
        'project_id', NEW.id,
        'project_name', NEW.name,
        'from_status', OLD.status,
        'to_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_emit_status_event ON public.projects;
CREATE TRIGGER projects_emit_status_event
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_emit_status_event();

-- ─── Task events (created + completed) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tasks_emit_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_terminal_new boolean := false;
  is_terminal_old boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_agent_event(
      NEW.workspace_id,
      'task.created',
      jsonb_build_object(
        'task_id', NEW.id,
        'project_id', NEW.project_id,
        'title', NEW.title,
        'status', NEW.status
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.workflow_status_id IS DISTINCT FROM OLD.workflow_status_id THEN
    IF NEW.workflow_status_id IS NOT NULL THEN
      SELECT COALESCE(is_terminal, false) INTO is_terminal_new
        FROM public.workflow_statuses WHERE id = NEW.workflow_status_id;
    END IF;
    IF OLD.workflow_status_id IS NOT NULL THEN
      SELECT COALESCE(is_terminal, false) INTO is_terminal_old
        FROM public.workflow_statuses WHERE id = OLD.workflow_status_id;
    END IF;
    IF is_terminal_new AND NOT is_terminal_old THEN
      PERFORM public.emit_agent_event(
        NEW.workspace_id,
        'task.completed',
        jsonb_build_object(
          'task_id', NEW.id,
          'project_id', NEW.project_id,
          'title', NEW.title
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_emit_events_insert ON public.tasks;
CREATE TRIGGER tasks_emit_events_insert
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_emit_events();

DROP TRIGGER IF EXISTS tasks_emit_events_update ON public.tasks;
CREATE TRIGGER tasks_emit_events_update
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_emit_events();
