
-- workspace_members: permission-based UPDATE (suspend / last_active)
CREATE POLICY "workspace_members_update_perm"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (
  has_permission(auth.uid(), workspace_id, 'members.suspend')
  OR auth.uid() = user_id
)
WITH CHECK (
  has_permission(auth.uid(), workspace_id, 'members.suspend')
  OR auth.uid() = user_id
);

-- workspace_members: permission-based DELETE (remove)
CREATE POLICY "workspace_members_delete_perm"
ON public.workspace_members
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), workspace_id, 'members.remove'));

-- user_roles: permission-based INSERT / UPDATE / DELETE (change_role / remove)
CREATE POLICY "user_roles_insert_perm"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), workspace_id, 'members.change_role'));

CREATE POLICY "user_roles_update_perm"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), workspace_id, 'members.change_role'))
WITH CHECK (has_permission(auth.uid(), workspace_id, 'members.change_role'));

CREATE POLICY "user_roles_delete_perm"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), workspace_id, 'members.remove'));

-- workspace_invitations: permission-based access (members.invite)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='workspace_invitations') THEN
    EXECUTE 'CREATE POLICY "workspace_invitations_insert_perm"
      ON public.workspace_invitations
      FOR INSERT TO authenticated
      WITH CHECK (has_permission(auth.uid(), workspace_id, ''members.invite''))';
    EXECUTE 'CREATE POLICY "workspace_invitations_delete_perm"
      ON public.workspace_invitations
      FOR DELETE TO authenticated
      USING (has_permission(auth.uid(), workspace_id, ''members.invite''))';
    EXECUTE 'CREATE POLICY "workspace_invitations_select_perm"
      ON public.workspace_invitations
      FOR SELECT TO authenticated
      USING (
        has_permission(auth.uid(), workspace_id, ''members.invite'')
        OR is_workspace_member(auth.uid(), workspace_id)
      )';
  END IF;
END $$;

-- Touch last_active when a member loads the workspace (helper used from app code)
CREATE OR REPLACE FUNCTION public.touch_last_active(_workspace_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.workspace_members
     SET last_active_at = now()
   WHERE workspace_id = _workspace_id
     AND user_id = auth.uid();
$$;
