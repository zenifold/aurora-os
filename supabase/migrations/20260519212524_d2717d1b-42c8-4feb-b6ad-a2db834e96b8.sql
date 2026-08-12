
CREATE TABLE public.timesheet_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  billable_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected')),
  submitter_notes TEXT,
  reviewer_id UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, week_start)
);

CREATE INDEX timesheet_submissions_ws_user_idx ON public.timesheet_submissions(workspace_id, user_id, week_start DESC);
CREATE INDEX timesheet_submissions_status_idx ON public.timesheet_submissions(workspace_id, status);

ALTER TABLE public.timesheet_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_select_members" ON public.timesheet_submissions
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ts_insert_own" ON public.timesheet_submissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = user_id);

CREATE POLICY "ts_update_own_or_admin" ON public.timesheet_submissions
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_id = timesheet_submissions.workspace_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner','admin')
      )
    )
  );

CREATE POLICY "ts_delete_own" ON public.timesheet_submissions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'submitted');

CREATE TRIGGER timesheet_submissions_set_updated_at
  BEFORE UPDATE ON public.timesheet_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
