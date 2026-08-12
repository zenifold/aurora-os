INSERT INTO public.role_permissions (role_id, permission)
SELECT rd.id, 'sharing.manage'
FROM public.role_definitions rd
WHERE rd.workspace_id IS NULL AND rd.slug IN ('owner','admin','manager')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shared_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('project','view','note','page','folder','dashboard')),
  resource_id UUID NOT NULL,
  label TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  allow_comments BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '{"can_view": true}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_links_workspace ON public.shared_links(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links(token);
CREATE INDEX IF NOT EXISTS idx_shared_links_resource ON public.shared_links(resource_type, resource_id);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_links_manage_with_permission"
ON public.shared_links FOR ALL
TO authenticated
USING (public.has_permission(auth.uid(), workspace_id, 'sharing.manage'))
WITH CHECK (public.has_permission(auth.uid(), workspace_id, 'sharing.manage'));

CREATE POLICY "shared_links_view_by_token"
ON public.shared_links FOR SELECT
TO anon, authenticated
USING (revoked_at IS NULL);

CREATE TRIGGER shared_links_touch_updated
BEFORE UPDATE ON public.shared_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.consume_share_token(_token TEXT, _password TEXT DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  workspace_id UUID,
  resource_type TEXT,
  resource_id UUID,
  label TEXT,
  allow_comments BOOLEAN,
  permissions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  link RECORD;
BEGIN
  SELECT * INTO link FROM public.shared_links WHERE token = _token LIMIT 1;
  IF link.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;
  IF link.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'REVOKED';
  END IF;
  IF link.expires_at IS NOT NULL AND link.expires_at < now() THEN
    RAISE EXCEPTION 'EXPIRED';
  END IF;
  IF link.max_views IS NOT NULL AND link.view_count >= link.max_views THEN
    RAISE EXCEPTION 'VIEW_LIMIT_REACHED';
  END IF;
  IF link.password_hash IS NOT NULL THEN
    IF _password IS NULL OR encode(extensions.digest(_password, 'sha256'), 'hex') <> link.password_hash THEN
      RAISE EXCEPTION 'PASSWORD_REQUIRED';
    END IF;
  END IF;

  UPDATE public.shared_links
     SET view_count = view_count + 1,
         last_viewed_at = now()
   WHERE shared_links.id = link.id;

  RETURN QUERY SELECT link.id, link.workspace_id, link.resource_type, link.resource_id,
                       link.label, link.allow_comments, link.permissions;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_share_token(TEXT, TEXT) TO anon, authenticated;