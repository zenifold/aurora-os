-- Rethink default sections: new workspaces no longer get the
-- Delivery / Ops / Sales scaffolding. Instead, seed a single
-- neutral "Workspace" section. Existing workspaces are untouched.
CREATE OR REPLACE FUNCTION public.seed_default_divisions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.divisions (workspace_id, name, slug, icon, color, division_type, is_default, sort_order)
  VALUES (new.id, 'Workspace', 'workspace', 'folder', '#6366f1', 'custom', true, 0)
  ON CONFLICT (workspace_id, slug) DO NOTHING;

  RETURN new;
END;
$$;