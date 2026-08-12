CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS tasks_title_trgm_idx
  ON public.tasks USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS projects_name_trgm_idx
  ON public.projects USING GIN (name gin_trgm_ops);
