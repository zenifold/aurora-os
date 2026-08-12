
-- Estimated hours on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_hours numeric;

-- Active timer (one per user)
CREATE TABLE IF NOT EXISTS public.active_timers (
  user_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  description text,
  is_billable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS active_timers_workspace_idx ON public.active_timers(workspace_id);
CREATE INDEX IF NOT EXISTS active_timers_task_idx ON public.active_timers(task_id);

ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active_timers_select_own"
  ON public.active_timers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "active_timers_insert_own"
  ON public.active_timers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "active_timers_update_own"
  ON public.active_timers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "active_timers_delete_own"
  ON public.active_timers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
