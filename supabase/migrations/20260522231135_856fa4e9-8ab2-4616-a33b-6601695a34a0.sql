
CREATE TABLE IF NOT EXISTS public.client_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  layout TEXT NOT NULL DEFAULT 'timeline',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  baseline JSONB,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_plans_client ON public.client_plans(client_account_id);
CREATE INDEX IF NOT EXISTS idx_client_plans_workspace ON public.client_plans(workspace_id);

ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view client plans"
  ON public.client_plans FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert client plans"
  ON public.client_plans FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update client plans"
  ON public.client_plans FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can delete client plans"
  ON public.client_plans FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER update_client_plans_updated_at
  BEFORE UPDATE ON public.client_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
