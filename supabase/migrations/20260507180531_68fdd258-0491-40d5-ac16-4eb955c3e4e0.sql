
-- 1. Add key to projects (nullable initially for backfill)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS key text;

-- Backfill: derive key from name (first 4 alphanum chars uppercase), make unique per workspace
DO $$
DECLARE
  p RECORD;
  base text;
  candidate text;
  suffix int;
BEGIN
  FOR p IN SELECT id, workspace_id, name FROM public.projects WHERE key IS NULL LOOP
    base := upper(regexp_replace(coalesce(p.name, 'PROJ'), '[^A-Za-z0-9]', '', 'g'));
    IF length(base) < 2 THEN base := 'PROJ'; END IF;
    base := substring(base, 1, 4);
    candidate := base;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM public.projects WHERE workspace_id = p.workspace_id AND key = candidate AND id <> p.id) LOOP
      suffix := suffix + 1;
      candidate := substring(base, 1, 3) || suffix::text;
    END LOOP;
    UPDATE public.projects SET key = candidate WHERE id = p.id;
  END LOOP;
END $$;

ALTER TABLE public.projects ALTER COLUMN key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_workspace_key_unique
  ON public.projects (workspace_id, upper(key));

-- Trigger to auto-fill key on insert if missing
CREATE OR REPLACE FUNCTION public.set_project_key_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
BEGIN
  IF NEW.key IS NOT NULL AND length(trim(NEW.key)) > 0 THEN
    NEW.key := upper(regexp_replace(NEW.key, '[^A-Za-z0-9]', '', 'g'));
    RETURN NEW;
  END IF;
  base := upper(regexp_replace(coalesce(NEW.name, 'PROJ'), '[^A-Za-z0-9]', '', 'g'));
  IF length(base) < 2 THEN base := 'PROJ'; END IF;
  base := substring(base, 1, 4);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.projects WHERE workspace_id = NEW.workspace_id AND upper(key) = candidate) LOOP
    suffix := suffix + 1;
    candidate := substring(base, 1, 3) || suffix::text;
  END LOOP;
  NEW.key := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS projects_set_key ON public.projects;
CREATE TRIGGER projects_set_key
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_project_key_default();

-- 2. Task numbering
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_number integer;

-- Backfill: assign incrementing numbers per project (ordered by created_at)
WITH numbered AS (
  SELECT id,
         row_number() OVER (PARTITION BY project_id ORDER BY created_at, id) AS n
  FROM public.tasks
  WHERE task_number IS NULL
)
UPDATE public.tasks t
SET task_number = numbered.n
FROM numbered
WHERE t.id = numbered.id;

ALTER TABLE public.tasks ALTER COLUMN task_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_number_unique
  ON public.tasks (project_id, task_number);

-- Trigger to auto-assign next task_number per project
CREATE OR REPLACE FUNCTION public.set_task_number_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.task_number IS NULL THEN
    SELECT COALESCE(MAX(task_number), 0) + 1 INTO NEW.task_number
    FROM public.tasks
    WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_set_number ON public.tasks;
CREATE TRIGGER tasks_set_number
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_number_default();
