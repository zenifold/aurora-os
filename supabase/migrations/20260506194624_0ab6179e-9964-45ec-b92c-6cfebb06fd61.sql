ALTER TABLE public.workspaces 
  ADD COLUMN IF NOT EXISTS nav_visibility jsonb NOT NULL DEFAULT 
    '{"resources":["owner","manager","member"],"capacity":["owner","manager","member"],"executive":["owner","manager"],"escalations":["owner","manager","member"]}'::jsonb;