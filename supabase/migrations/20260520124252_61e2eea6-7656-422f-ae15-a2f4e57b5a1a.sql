
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS requires_signoff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signoff_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS signoff_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS signoff_requested_by uuid,
  ADD COLUMN IF NOT EXISTS signoff_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signoff_signed_by_portal_access_id uuid REFERENCES public.client_portal_access(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signoff_signed_name text,
  ADD COLUMN IF NOT EXISTS signoff_signature_text text,
  ADD COLUMN IF NOT EXISTS signoff_notes text,
  ADD COLUMN IF NOT EXISTS signoff_rejection_reason text;

ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_signoff_status_check;
ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_signoff_status_check
  CHECK (signoff_status IN ('not_required','pending','requested','approved','rejected'));

CREATE TABLE IF NOT EXISTS public.milestone_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL,
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('requested','approved','rejected','reset')),
  client_portal_access_id uuid REFERENCES public.client_portal_access(id) ON DELETE SET NULL,
  actor_user_id uuid,
  signed_name text,
  signature_text text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestone_signoffs_milestone_idx ON public.milestone_signoffs(milestone_id);
CREATE INDEX IF NOT EXISTS milestone_signoffs_project_idx ON public.milestone_signoffs(project_id);

ALTER TABLE public.milestone_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestone_signoffs_select_members" ON public.milestone_signoffs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "milestone_signoffs_insert_members" ON public.milestone_signoffs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "milestone_signoffs_delete_members" ON public.milestone_signoffs
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
