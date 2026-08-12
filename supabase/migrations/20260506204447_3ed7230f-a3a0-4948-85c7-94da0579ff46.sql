ALTER TABLE public.views ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Backfill positions per project based on created_at order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1 AS rn
  FROM public.views
)
UPDATE public.views v SET position = o.rn FROM ordered o WHERE v.id = o.id;

CREATE INDEX IF NOT EXISTS idx_views_project_position ON public.views(project_id, position);