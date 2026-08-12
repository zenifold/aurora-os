
CREATE TABLE IF NOT EXISTS public.agent_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('schedule','event')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  goal_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  next_run_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_triggers_due
  ON public.agent_triggers (next_run_at)
  WHERE is_active = true AND trigger_type = 'schedule';

CREATE INDEX IF NOT EXISTS idx_agent_triggers_event
  ON public.agent_triggers (workspace_id, trigger_type)
  WHERE is_active = true AND trigger_type = 'event';

ALTER TABLE public.agent_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read agent_triggers"
  ON public.agent_triggers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r
                 WHERE r.workspace_id = agent_triggers.workspace_id AND r.user_id = auth.uid()));

CREATE POLICY "Members insert agent_triggers"
  ON public.agent_triggers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r
                      WHERE r.workspace_id = agent_triggers.workspace_id AND r.user_id = auth.uid()));

CREATE POLICY "Members update agent_triggers"
  ON public.agent_triggers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r
                 WHERE r.workspace_id = agent_triggers.workspace_id AND r.user_id = auth.uid()));

CREATE POLICY "Members delete agent_triggers"
  ON public.agent_triggers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r
                 WHERE r.workspace_id = agent_triggers.workspace_id AND r.user_id = auth.uid()));
