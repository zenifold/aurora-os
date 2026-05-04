
-- Automations
CREATE TABLE public.ai_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_event text NOT NULL DEFAULT 'task.created',
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_id uuid NOT NULL,
  instructions_template text,
  apply_action text NOT NULL DEFAULT 'comment',
  run_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_automations_ws_active_idx ON public.ai_automations(workspace_id, is_active);

ALTER TABLE public.ai_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_automations_select_members ON public.ai_automations
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY ai_automations_insert_owner ON public.ai_automations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

CREATE POLICY ai_automations_update_owner ON public.ai_automations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

CREATE POLICY ai_automations_delete_owner ON public.ai_automations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

CREATE TRIGGER set_ai_automations_updated_at
  BEFORE UPDATE ON public.ai_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Run log
CREATE TABLE public.ai_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  task_id uuid,
  status text NOT NULL DEFAULT 'pending',
  trigger_event text,
  output text,
  error_message text,
  duration_ms integer,
  tokens_used integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_automation_runs_automation_idx ON public.ai_automation_runs(automation_id, created_at DESC);
CREATE INDEX ai_automation_runs_workspace_idx ON public.ai_automation_runs(workspace_id, created_at DESC);

ALTER TABLE public.ai_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_automation_runs_select_members ON public.ai_automation_runs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY ai_automation_runs_insert_members ON public.ai_automation_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
