
-- Helper: can the caller manage workspace-level settings for _target_user?
-- True when caller and target share a workspace and caller is owner/admin/manager there.
CREATE OR REPLACE FUNCTION public.can_manage_member(_caller uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur_caller
    JOIN public.workspace_members wm_target
      ON wm_target.workspace_id = ur_caller.workspace_id
    WHERE ur_caller.user_id = _caller
      AND wm_target.user_id = _target
      AND ur_caller.role IN ('owner'::workspace_role,
                             'admin'::workspace_role,
                             'manager'::workspace_role)
  );
$$;

-- New UPDATE policy on profiles: admins/managers can update any shared member's profile
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin
  ON public.profiles
  FOR UPDATE
  USING (public.can_manage_member(auth.uid(), id))
  WITH CHECK (public.can_manage_member(auth.uid(), id));
