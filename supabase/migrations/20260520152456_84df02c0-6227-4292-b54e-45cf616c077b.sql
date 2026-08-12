
ALTER TABLE public.client_portal_access
  ADD COLUMN IF NOT EXISTS can_see_invoices boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_see_documents boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  client_portal_access_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal',
  impact_areas text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted',
  submitted_by_name text,
  submitted_by_email text,
  estimated_cost numeric(12,2),
  estimated_days integer,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_project ON public.change_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_workspace_status ON public.change_requests(workspace_id, status);

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view change requests"
  ON public.change_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.workspace_id = change_requests.workspace_id
        AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners/managers can update change requests"
  ON public.change_requests FOR UPDATE
  USING (
    public.has_role(auth.uid(), change_requests.workspace_id, 'owner'::workspace_role)
    OR public.has_role(auth.uid(), change_requests.workspace_id, 'manager'::workspace_role)
  );

CREATE POLICY "Workspace owners/managers can delete change requests"
  ON public.change_requests FOR DELETE
  USING (
    public.has_role(auth.uid(), change_requests.workspace_id, 'owner'::workspace_role)
    OR public.has_role(auth.uid(), change_requests.workspace_id, 'manager'::workspace_role)
  );

CREATE TRIGGER trg_change_requests_updated_at
  BEFORE UPDATE ON public.change_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
