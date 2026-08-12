-- Drop columns referencing divisions
ALTER TABLE public.projects DROP COLUMN IF EXISTS division_id;
ALTER TABLE public.folders DROP COLUMN IF EXISTS division_id;
ALTER TABLE public.project_templates DROP COLUMN IF EXISTS division_id;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.seed_default_divisions(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.seed_default_divisions() CASCADE;
DROP FUNCTION IF EXISTS public.divisions_track_slug_alias() CASCADE;

-- Drop the divisions table
DROP TABLE IF EXISTS public.divisions CASCADE;