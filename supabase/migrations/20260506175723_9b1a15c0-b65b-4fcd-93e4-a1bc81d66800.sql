
CREATE TABLE public.portal_deliverable_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  deliverable_id uuid NOT NULL REFERENCES public.client_deliverables(id) ON DELETE CASCADE,
  author_kind text NOT NULL CHECK (author_kind IN ('team', 'client')),
  author_user_id uuid NULL,
  author_portal_access_id uuid NULL REFERENCES public.client_portal_access(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdc_deliverable ON public.portal_deliverable_comments(deliverable_id, created_at);

ALTER TABLE public.portal_deliverable_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdc_select_members ON public.portal_deliverable_comments
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY pdc_insert_members ON public.portal_deliverable_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_member(auth.uid(), workspace_id)
    AND author_kind = 'team'
    AND author_user_id = auth.uid()
  );

CREATE POLICY pdc_delete_author ON public.portal_deliverable_comments
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());
