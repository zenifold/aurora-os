-- Project delivery metadata: client flag, phase, health, contract type, deadline
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_client_project boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'discovery',
  ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'tm',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS target_end_date date,
  ADD COLUMN IF NOT EXISTS target_margin_pct numeric;

-- User role: position label for default landing & nav visibility
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS position text;

CREATE INDEX IF NOT EXISTS idx_projects_is_client_project
  ON public.projects (workspace_id, is_client_project);
