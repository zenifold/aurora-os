
-- 1. projects.lifecycle
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS lifecycle text NOT NULL DEFAULT 'active';

DO $$ BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_lifecycle_check
    CHECK (lifecycle IN ('proposed','active','on_hold','complete','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_projects_client_lifecycle
  ON public.projects (client_account_id, lifecycle);

-- 2. ai_artifacts
CREATE TABLE IF NOT EXISTS public.ai_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('draft','summary','risk','communication','other')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','reviewed','applied','archived')),
  source_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_artifacts_client ON public.ai_artifacts (client_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_artifacts_workspace ON public.ai_artifacts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_artifacts_kind ON public.ai_artifacts (client_account_id, kind);

ALTER TABLE public.ai_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_artifacts_select ON public.ai_artifacts;
CREATE POLICY ai_artifacts_select ON public.ai_artifacts
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS ai_artifacts_insert ON public.ai_artifacts;
CREATE POLICY ai_artifacts_insert ON public.ai_artifacts
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS ai_artifacts_update ON public.ai_artifacts;
CREATE POLICY ai_artifacts_update ON public.ai_artifacts
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS ai_artifacts_delete ON public.ai_artifacts;
CREATE POLICY ai_artifacts_delete ON public.ai_artifacts
  FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

DROP TRIGGER IF EXISTS ai_artifacts_set_updated_at ON public.ai_artifacts;
CREATE TRIGGER ai_artifacts_set_updated_at
  BEFORE UPDATE ON public.ai_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
