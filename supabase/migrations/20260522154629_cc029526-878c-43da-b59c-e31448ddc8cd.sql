
-- Engagement handover state machine + discovery brief artifact

CREATE TYPE handover_stage AS ENUM (
  'discovery',
  'sow_draft',
  'sow_internal_review',
  'sow_customer_review',
  'signed',
  'plan_draft',
  'plan_review',
  'executing',
  'delivered'
);

CREATE TABLE public.engagement_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  stage handover_stage NOT NULL DEFAULT 'discovery',
  pending_approver_role text,
  current_agent_run_id uuid,
  gate_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE INDEX engagement_handovers_workspace_idx ON public.engagement_handovers(workspace_id);
CREATE INDEX engagement_handovers_project_idx ON public.engagement_handovers(project_id);

ALTER TABLE public.engagement_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY engagement_handovers_select ON public.engagement_handovers
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY engagement_handovers_insert ON public.engagement_handovers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY engagement_handovers_update ON public.engagement_handovers
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY engagement_handovers_delete ON public.engagement_handovers
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER set_engagement_handovers_updated_at
  BEFORE UPDATE ON public.engagement_handovers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Discovery briefs (one per deal, agent-drafted then human-edited)
CREATE TABLE public.discovery_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  business_goals text,
  target_users text,
  scope_summary text,
  constraints text,
  tech_preferences text,
  success_metrics text,
  unknowns jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by_agent_run_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, version)
);

CREATE INDEX discovery_briefs_workspace_idx ON public.discovery_briefs(workspace_id);
CREATE INDEX discovery_briefs_deal_idx ON public.discovery_briefs(deal_id);

ALTER TABLE public.discovery_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY discovery_briefs_select ON public.discovery_briefs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY discovery_briefs_insert ON public.discovery_briefs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY discovery_briefs_update ON public.discovery_briefs
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY discovery_briefs_delete ON public.discovery_briefs
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER set_discovery_briefs_updated_at
  BEFORE UPDATE ON public.discovery_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
