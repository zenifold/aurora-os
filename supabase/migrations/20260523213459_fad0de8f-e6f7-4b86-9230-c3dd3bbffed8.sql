
ALTER TABLE public.client_accounts ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.client_account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_account_id, user_id)
);
CREATE INDEX IF NOT EXISTS client_account_members_user_idx ON public.client_account_members(user_id);
CREATE INDEX IF NOT EXISTS client_account_members_account_idx ON public.client_account_members(client_account_id);

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS project_members_project_idx ON public.project_members(project_id);

ALTER TABLE public.client_account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role IN ('owner'::workspace_role, 'admin'::workspace_role)
  );
$$;

DROP POLICY IF EXISTS "members read client_accounts" ON public.client_accounts;
CREATE POLICY "read client_accounts" ON public.client_accounts FOR SELECT
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      NOT is_private
      OR is_workspace_admin(auth.uid(), workspace_id)
      OR EXISTS (SELECT 1 FROM public.client_account_members m
        WHERE m.client_account_id = client_accounts.id AND m.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "members update client_accounts" ON public.client_accounts;
CREATE POLICY "update client_accounts" ON public.client_accounts FOR UPDATE
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      NOT is_private
      OR is_workspace_admin(auth.uid(), workspace_id)
      OR EXISTS (SELECT 1 FROM public.client_account_members m
        WHERE m.client_account_id = client_accounts.id AND m.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "members delete client_accounts" ON public.client_accounts;
CREATE POLICY "delete client_accounts" ON public.client_accounts FOR DELETE
  USING (
    is_workspace_admin(auth.uid(), workspace_id)
    OR (NOT is_private AND is_workspace_member(auth.uid(), workspace_id))
  );

DROP POLICY IF EXISTS "projects_select_members" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      NOT is_private
      OR is_workspace_admin(auth.uid(), workspace_id)
      OR EXISTS (SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = projects.id AND pm.user_id = auth.uid())
      OR (client_account_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.client_account_members cam
        WHERE cam.client_account_id = projects.client_account_id AND cam.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "projects_update_members" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (
    is_workspace_member(auth.uid(), workspace_id)
    AND (
      NOT is_private
      OR is_workspace_admin(auth.uid(), workspace_id)
      OR EXISTS (SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = projects.id AND pm.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "projects_delete_members" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (
    is_workspace_admin(auth.uid(), workspace_id)
    OR (NOT is_private AND is_workspace_member(auth.uid(), workspace_id))
  );

CREATE POLICY "cam_select" ON public.client_account_members FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "cam_insert" ON public.client_account_members FOR INSERT TO authenticated
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "cam_delete" ON public.client_account_members FOR DELETE TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id) OR user_id = auth.uid());

CREATE POLICY "pm_select" ON public.project_members FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "pm_insert" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "pm_delete" ON public.project_members FOR DELETE TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id) OR user_id = auth.uid());
