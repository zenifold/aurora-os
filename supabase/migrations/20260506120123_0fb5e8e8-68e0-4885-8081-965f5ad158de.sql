-- Track previous slugs so renamed sections still resolve
ALTER TABLE public.divisions
  ADD COLUMN IF NOT EXISTS slug_aliases text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS divisions_slug_aliases_idx
  ON public.divisions USING GIN (slug_aliases);

-- Trigger: when slug changes, push the old slug into slug_aliases
CREATE OR REPLACE FUNCTION public.divisions_track_slug_alias()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    -- avoid duplicates and skip the new slug itself
    NEW.slug_aliases := (
      SELECT array_agg(DISTINCT a)
      FROM unnest(COALESCE(OLD.slug_aliases, '{}') || ARRAY[OLD.slug]) AS a
      WHERE a <> NEW.slug
    );
    IF NEW.slug_aliases IS NULL THEN
      NEW.slug_aliases := '{}';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS divisions_track_slug_alias ON public.divisions;
CREATE TRIGGER divisions_track_slug_alias
  BEFORE UPDATE ON public.divisions
  FOR EACH ROW
  EXECUTE FUNCTION public.divisions_track_slug_alias();