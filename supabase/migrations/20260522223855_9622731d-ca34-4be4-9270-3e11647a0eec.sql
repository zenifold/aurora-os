CREATE TABLE public.agent_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  stage text NOT NULL CHECK (stage IN ('presales','fulfillment')),
  target_kind text NOT NULL CHECK (target_kind IN ('deal','sow','project','client')),
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  goal_template text NOT NULL,
  autonomy_override text CHECK (autonomy_override IN ('suggest','bounded','autonomous')),
  is_active boolean NOT NULL DEFAULT true,
  is_seeded boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX agent_playbooks_ws_stage_idx ON public.agent_playbooks (workspace_id, stage, target_kind) WHERE is_active;

ALTER TABLE public.agent_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbooks_select_members" ON public.agent_playbooks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.workspace_id = agent_playbooks.workspace_id AND ur.user_id = auth.uid()));

CREATE POLICY "playbooks_insert_members" ON public.agent_playbooks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.workspace_id = agent_playbooks.workspace_id AND ur.user_id = auth.uid()));

CREATE POLICY "playbooks_update_members" ON public.agent_playbooks
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.workspace_id = agent_playbooks.workspace_id AND ur.user_id = auth.uid()));

CREATE POLICY "playbooks_delete_members" ON public.agent_playbooks
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.workspace_id = agent_playbooks.workspace_id AND ur.user_id = auth.uid()));

CREATE TRIGGER update_agent_playbooks_updated_at
  BEFORE UPDATE ON public.agent_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();