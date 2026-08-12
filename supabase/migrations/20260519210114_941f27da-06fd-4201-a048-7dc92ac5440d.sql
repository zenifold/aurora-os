
-- =========================================
-- Phase 1 close-out: CSAT capture at milestones
-- Phase 2 foundation: Project status updates + baselines
-- =========================================

-- ---------- CSAT responses ----------
CREATE TABLE public.csat_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE CASCADE,
  status_update_id UUID,
  client_portal_access_id UUID REFERENCES public.client_portal_access(id) ON DELETE SET NULL,
  respondent_name TEXT,
  respondent_email TEXT,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','email','internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_csat_project ON public.csat_responses(project_id);
CREATE INDEX idx_csat_milestone ON public.csat_responses(milestone_id);
CREATE INDEX idx_csat_workspace_created ON public.csat_responses(workspace_id, created_at DESC);

ALTER TABLE public.csat_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csat_select_members" ON public.csat_responses
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "csat_insert_members" ON public.csat_responses
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "csat_update_members" ON public.csat_responses
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "csat_delete_members" ON public.csat_responses
  FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Surface milestone-level CSAT request settings
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS request_csat BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS csat_requested_at TIMESTAMPTZ;

-- ---------- Project status updates (first-class) ----------
CREATE TABLE public.project_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  health TEXT NOT NULL DEFAULT 'on_track' CHECK (health IN ('on_track','at_risk','off_track','complete')),
  headline TEXT,
  summary TEXT,
  accomplishments TEXT,
  next_period TEXT,
  risks TEXT,
  asks TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client','both')),
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT,
  source_snapshot JSONB,
  published_at TIMESTAMPTZ,
  published_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psu_project_created ON public.project_status_updates(project_id, created_at DESC);
CREATE INDEX idx_psu_workspace ON public.project_status_updates(workspace_id);
CREATE INDEX idx_psu_published ON public.project_status_updates(workspace_id, status, published_at DESC);

ALTER TABLE public.project_status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psu_select_members" ON public.project_status_updates
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "psu_insert_members" ON public.project_status_updates
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "psu_update_members" ON public.project_status_updates
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "psu_delete_members" ON public.project_status_updates
  FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER psu_updated_at
  BEFORE UPDATE ON public.project_status_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK from csat -> status update (added after table exists)
ALTER TABLE public.csat_responses
  ADD CONSTRAINT csat_status_update_fkey
  FOREIGN KEY (status_update_id) REFERENCES public.project_status_updates(id) ON DELETE SET NULL;

-- ---------- Project baselines (Phase 2) ----------
CREATE TABLE public.project_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Baseline',
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  target_end_date DATE,
  total_budget_hours NUMERIC,
  total_budget_amount NUMERIC,
  milestones_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pb_project ON public.project_baselines(project_id, created_at DESC);
CREATE INDEX idx_pb_workspace ON public.project_baselines(workspace_id);

ALTER TABLE public.project_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pb_select_members" ON public.project_baselines
  FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "pb_insert_members" ON public.project_baselines
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "pb_update_members" ON public.project_baselines
  FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "pb_delete_members" ON public.project_baselines
  FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
