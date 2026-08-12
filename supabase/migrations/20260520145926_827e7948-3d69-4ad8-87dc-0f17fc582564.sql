
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS work_mode text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS enabled_tabs text[];
