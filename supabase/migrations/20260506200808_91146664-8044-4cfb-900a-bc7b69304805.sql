
ALTER TABLE public.divisions DROP CONSTRAINT IF EXISTS divisions_division_type_check;

ALTER TABLE public.divisions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS allowed_content jsonb NOT NULL DEFAULT '["folders","projects","pages"]'::jsonb;
