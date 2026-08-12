-- Workspace logo + auto-join email domains
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS auto_join_domains text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_workspaces_auto_join_domains
  ON public.workspaces USING GIN (auto_join_domains);

-- Section icon (already has icon column, no change needed)

-- Storage bucket for workspace logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "workspace_logos_public_read" ON storage.objects;
CREATE POLICY "workspace_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-logos');

DROP POLICY IF EXISTS "workspace_logos_authenticated_write" ON storage.objects;
CREATE POLICY "workspace_logos_authenticated_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-logos');

DROP POLICY IF EXISTS "workspace_logos_authenticated_update" ON storage.objects;
CREATE POLICY "workspace_logos_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workspace-logos');

DROP POLICY IF EXISTS "workspace_logos_authenticated_delete" ON storage.objects;
CREATE POLICY "workspace_logos_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-logos');

-- RPC: look up a workspace that auto-joins users from this email's domain.
-- SECURITY DEFINER so a user with no membership yet can find their org.
CREATE OR REPLACE FUNCTION public.find_workspace_for_email(_email text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  matched_domain text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  domain text;
BEGIN
  IF _email IS NULL OR position('@' in _email) = 0 THEN
    RETURN;
  END IF;
  domain := lower(split_part(_email, '@', 2));
  -- Skip generic personal-email providers
  IF domain IN ('gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','proton.me','protonmail.com','aol.com','live.com','me.com','msn.com') THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT w.id, w.name, w.slug, w.logo_url, domain
    FROM public.workspaces w
    WHERE domain = ANY (w.auto_join_domains)
    ORDER BY w.created_at ASC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_workspace_for_email(text) TO authenticated;

-- RPC: join the calling user to a workspace if its auto_join_domains contains
-- the user's verified email domain.
CREATE OR REPLACE FUNCTION public.join_workspace_by_email_domain(_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  domain text;
  ws_domains text[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  IF user_email IS NULL OR position('@' in user_email) = 0 THEN
    RAISE EXCEPTION 'no email on account';
  END IF;
  domain := lower(split_part(user_email, '@', 2));

  SELECT auto_join_domains INTO ws_domains
  FROM public.workspaces WHERE id = _workspace_id;
  IF ws_domains IS NULL OR NOT (domain = ANY (ws_domains)) THEN
    RAISE EXCEPTION 'email domain not allowed for this workspace';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id)
  VALUES (_workspace_id, uid)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (workspace_id, user_id, role)
  VALUES (_workspace_id, uid, 'member')
  ON CONFLICT DO NOTHING;

  RETURN _workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_workspace_by_email_domain(uuid) TO authenticated;