
-- 1. channel_members INSERT: fix self-referential join (m.channel_id = m.channel_id)
DROP POLICY IF EXISTS channel_members_insert ON public.channel_members;
CREATE POLICY channel_members_insert ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
      OR EXISTS (
        SELECT 1 FROM public.channel_members m
        WHERE m.channel_id = channel_members.channel_id
          AND m.user_id = auth.uid()
          AND m.role = 'owner'
      )
    )
  );

-- 2. channels UPDATE: fix self-referential join (m.channel_id = m.id)
DROP POLICY IF EXISTS channels_update ON public.channels;
CREATE POLICY channels_update ON public.channels
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
    OR EXISTS (
      SELECT 1 FROM public.channel_members m
      WHERE m.channel_id = channels.id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );

-- 3. intake_forms / intake_form_responses: swapped arguments
DROP POLICY IF EXISTS "Members manage intake forms" ON public.intake_forms;
CREATE POLICY "Members manage intake forms" ON public.intake_forms
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "Members manage intake responses" ON public.intake_form_responses;
CREATE POLICY "Members manage intake responses" ON public.intake_form_responses
  FOR ALL TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- 4. shared_links: drop the public SELECT policy — token lookups now go through consume_share_token RPC
DROP POLICY IF EXISTS shared_links_view_by_token ON public.shared_links;

-- 5. workspace_invitations: drop public SELECT and add a SECURITY DEFINER RPC that returns only the matching row
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.workspace_invitations;

CREATE OR REPLACE FUNCTION public.lookup_workspace_invitation(_token text)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  workspace_name text,
  workspace_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.workspace_id, i.email, i.role::text, i.status, i.expires_at,
         w.name, w.slug
    FROM public.workspace_invitations i
    LEFT JOIN public.workspaces w ON w.id = i.workspace_id
   WHERE i.token = _token
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_workspace_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_workspace_invitation(text) TO anon, authenticated;

-- The accept flow still needs to UPDATE by id; "Authenticated users accept invitations" policy remains.

-- 6. user_calendar_connections: add INSERT policy
CREATE POLICY "owner insert calendar connection" ON public.user_calendar_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_workspace_member(auth.uid(), workspace_id)
  );

-- 7. Storage: client-deliverables INSERT policy for workspace members
CREATE POLICY client_deliv_files_insert_members ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-deliverables'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 8. Storage: tighten workspace-logos so only workspace owners can write/update/delete
DROP POLICY IF EXISTS workspace_logos_authenticated_write ON storage.objects;
DROP POLICY IF EXISTS workspace_logos_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS workspace_logos_authenticated_delete ON storage.objects;

CREATE POLICY workspace_logos_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND public.has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'owner'::workspace_role)
  );

CREATE POLICY workspace_logos_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND public.has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'owner'::workspace_role)
  );

CREATE POLICY workspace_logos_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND public.has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'owner'::workspace_role)
  );
