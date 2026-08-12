CREATE OR REPLACE FUNCTION public.seed_default_divisions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.divisions (workspace_id, name, slug, icon, color, division_type, is_default, sort_order)
  VALUES (new.id, 'Delivery', 'delivery', 'briefcase', '#8b5cf6', 'delivery', true, 0)
  ON CONFLICT (workspace_id, slug) DO NOTHING;

  INSERT INTO public.divisions (workspace_id, name, slug, icon, color, division_type, sort_order)
  VALUES (new.id, 'Ops', 'ops', 'settings-2', '#10b981', 'operations', 1)
  ON CONFLICT (workspace_id, slug) DO NOTHING;

  RETURN new;
END;
$$;