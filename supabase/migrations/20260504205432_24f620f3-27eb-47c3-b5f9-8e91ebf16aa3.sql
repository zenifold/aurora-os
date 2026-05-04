DROP POLICY IF EXISTS "workspaces_select_members" ON public.workspaces;

CREATE POLICY "workspaces_select_members_or_owner"
ON public.workspaces
FOR SELECT
TO authenticated
USING (
  public.is_workspace_member(auth.uid(), id)
  OR owner_id = auth.uid()
);