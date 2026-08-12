-- ============================================================
-- Phase 1: RBAC permission foundation
-- ============================================================

-- 1. Expand the workspace_role enum (admin, viewer, guest)
ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'guest';

-- 2. Member suspension + activity tracking
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- 3. role_definitions — system + custom roles
CREATE TABLE IF NOT EXISTS public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_guest_role boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_role_definitions_workspace ON public.role_definitions(workspace_id);

ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

-- 4. role_permissions — which actions each role grants
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 5. audit_log_entries
CREATE TABLE IF NOT EXISTS public.audit_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace_created ON public.audit_log_entries(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_log_entries(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log_entries(action);

ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;

-- 6. Link user_roles to custom role definitions (optional column)
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS role_definition_id uuid REFERENCES public.role_definitions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_user_roles_role_definition ON public.user_roles(role_definition_id);

-- 7. has_permission helper — checks via role_definition_id OR enum-name fallback
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _workspace_id uuid,
  _permission text
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.role_definitions rd_custom ON rd_custom.id = ur.role_definition_id
    LEFT JOIN public.role_definitions rd_system
      ON rd_system.workspace_id IS NULL
     AND rd_system.slug = ur.role::text
    JOIN public.role_permissions rp
      ON rp.role_id = COALESCE(rd_custom.id, rd_system.id)
    WHERE ur.user_id = _user_id
      AND ur.workspace_id = _workspace_id
      AND rp.permission = _permission
  )
  -- Owner always has every permission, even before seed runs
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND role = 'owner'::workspace_role
  );
$$;

-- 8. log_audit_event helper
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _workspace_id uuid,
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _target_label text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  actor_email_val text;
BEGIN
  SELECT email INTO actor_email_val FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_log_entries (
    workspace_id, actor_id, actor_email, action, target_type, target_id, target_label, metadata
  ) VALUES (
    _workspace_id, auth.uid(), actor_email_val, _action, _target_type, _target_id, _target_label, _metadata
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- 9. Seed system role definitions (workspace_id = NULL → applies to all workspaces)
INSERT INTO public.role_definitions (workspace_id, name, slug, description, is_system, is_guest_role)
VALUES
  (NULL, 'Owner', 'owner', 'Full control over the workspace, billing, and members', true, false),
  (NULL, 'Admin', 'admin', 'Manage members, settings, and most data — cannot delete workspace or change billing', true, false),
  (NULL, 'Manager', 'manager', 'Lead projects and edit most data — cannot manage members or settings', true, false),
  (NULL, 'Member', 'member', 'Create and edit assigned work', true, false),
  (NULL, 'Viewer', 'viewer', 'Read-only access to workspace data', true, false),
  (NULL, 'Guest', 'guest', 'Limited access to specifically shared resources only', true, true)
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- 10. Seed permissions for each system role
DO $$
DECLARE
  owner_id uuid;
  admin_id uuid;
  manager_id uuid;
  member_id uuid;
  viewer_id uuid;
  guest_id uuid;

  all_perms text[] := ARRAY[
    'workspace.manage_settings','workspace.manage_billing','workspace.manage_members',
    'workspace.view_audit_log','workspace.manage_domains','workspace.manage_roles','workspace.delete',
    'projects.create','projects.edit_all','projects.delete','projects.archive','projects.view',
    'finance.view','finance.edit','finance.approve_invoices',
    'crm.view_clients','crm.edit_clients','crm.delete_clients',
    'members.invite','members.remove','members.change_role','members.suspend',
    'sharing.create_external_link','sharing.invite_guest',
    'audit.view','audit.export'
  ];

  admin_perms text[] := ARRAY[
    'workspace.manage_settings','workspace.manage_members','workspace.view_audit_log',
    'workspace.manage_domains','workspace.manage_roles',
    'projects.create','projects.edit_all','projects.delete','projects.archive','projects.view',
    'finance.view','finance.edit','finance.approve_invoices',
    'crm.view_clients','crm.edit_clients','crm.delete_clients',
    'members.invite','members.remove','members.change_role','members.suspend',
    'sharing.create_external_link','sharing.invite_guest',
    'audit.view','audit.export'
  ];

  manager_perms text[] := ARRAY[
    'projects.create','projects.edit_all','projects.archive','projects.view',
    'finance.view','finance.edit',
    'crm.view_clients','crm.edit_clients',
    'members.invite',
    'sharing.create_external_link','sharing.invite_guest'
  ];

  member_perms text[] := ARRAY[
    'projects.create','projects.view',
    'finance.view',
    'crm.view_clients','crm.edit_clients',
    'sharing.invite_guest'
  ];

  viewer_perms text[] := ARRAY[
    'projects.view','finance.view','crm.view_clients'
  ];

  guest_perms text[] := ARRAY[]::text[];

  p text;
BEGIN
  SELECT id INTO owner_id   FROM public.role_definitions WHERE workspace_id IS NULL AND slug='owner';
  SELECT id INTO admin_id   FROM public.role_definitions WHERE workspace_id IS NULL AND slug='admin';
  SELECT id INTO manager_id FROM public.role_definitions WHERE workspace_id IS NULL AND slug='manager';
  SELECT id INTO member_id  FROM public.role_definitions WHERE workspace_id IS NULL AND slug='member';
  SELECT id INTO viewer_id  FROM public.role_definitions WHERE workspace_id IS NULL AND slug='viewer';
  SELECT id INTO guest_id   FROM public.role_definitions WHERE workspace_id IS NULL AND slug='guest';

  -- Wipe + re-seed system role permissions
  DELETE FROM public.role_permissions
   WHERE role_id IN (owner_id, admin_id, manager_id, member_id, viewer_id, guest_id);

  FOREACH p IN ARRAY all_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission) VALUES (owner_id, p);
  END LOOP;
  FOREACH p IN ARRAY admin_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission) VALUES (admin_id, p);
  END LOOP;
  FOREACH p IN ARRAY manager_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission) VALUES (manager_id, p);
  END LOOP;
  FOREACH p IN ARRAY member_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission) VALUES (member_id, p);
  END LOOP;
  FOREACH p IN ARRAY viewer_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission) VALUES (viewer_id, p);
  END LOOP;
  FOREACH p IN ARRAY guest_perms LOOP
    INSERT INTO public.role_permissions (role_id, permission) VALUES (guest_id, p);
  END LOOP;
END $$;

-- 11. RLS policies
-- role_definitions: workspace members can read their workspace's roles + all system roles
CREATE POLICY "role_definitions_select_members"
  ON public.role_definitions FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NULL
    OR is_workspace_member(auth.uid(), workspace_id)
  );

CREATE POLICY "role_definitions_insert_managers"
  ON public.role_definitions FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL
    AND has_permission(auth.uid(), workspace_id, 'workspace.manage_roles')
  );

CREATE POLICY "role_definitions_update_managers"
  ON public.role_definitions FOR UPDATE
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND NOT is_system
    AND has_permission(auth.uid(), workspace_id, 'workspace.manage_roles')
  );

CREATE POLICY "role_definitions_delete_managers"
  ON public.role_definitions FOR DELETE
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND NOT is_system
    AND has_permission(auth.uid(), workspace_id, 'workspace.manage_roles')
  );

-- role_permissions: members read, managers write
CREATE POLICY "role_permissions_select_members"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.role_definitions rd
      WHERE rd.id = role_permissions.role_id
        AND (rd.workspace_id IS NULL OR is_workspace_member(auth.uid(), rd.workspace_id))
    )
  );

CREATE POLICY "role_permissions_write_managers"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.role_definitions rd
      WHERE rd.id = role_permissions.role_id
        AND rd.workspace_id IS NOT NULL
        AND NOT rd.is_system
        AND has_permission(auth.uid(), rd.workspace_id, 'workspace.manage_roles')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.role_definitions rd
      WHERE rd.id = role_permissions.role_id
        AND rd.workspace_id IS NOT NULL
        AND NOT rd.is_system
        AND has_permission(auth.uid(), rd.workspace_id, 'workspace.manage_roles')
    )
  );

-- audit_log_entries: members with audit.view permission read, system writes via log_audit_event
CREATE POLICY "audit_log_select_with_permission"
  ON public.audit_log_entries FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), workspace_id, 'audit.view'));

-- No INSERT/UPDATE/DELETE policies — only SECURITY DEFINER log_audit_event() writes

-- 12. updated_at trigger for role_definitions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS role_definitions_updated_at ON public.role_definitions;
CREATE TRIGGER role_definitions_updated_at
  BEFORE UPDATE ON public.role_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();