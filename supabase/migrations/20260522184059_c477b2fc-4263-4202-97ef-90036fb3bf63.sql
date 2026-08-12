
-- Phase 1: Container model + workspace mode + sidebar pins

-- 1. Add container kind + owner to client_accounts
ALTER TABLE public.client_accounts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.client_accounts
  DROP CONSTRAINT IF EXISTS client_accounts_kind_check;
ALTER TABLE public.client_accounts
  ADD CONSTRAINT client_accounts_kind_check
  CHECK (kind IN ('client', 'personal', 'internal'));

-- Personal containers must have an owner; client/internal must not
ALTER TABLE public.client_accounts
  DROP CONSTRAINT IF EXISTS client_accounts_owner_kind_check;
ALTER TABLE public.client_accounts
  ADD CONSTRAINT client_accounts_owner_kind_check
  CHECK (
    (kind = 'personal' AND owner_user_id IS NOT NULL)
    OR (kind <> 'personal' AND owner_user_id IS NULL)
  );

-- One internal container per workspace, one personal per (workspace, user)
CREATE UNIQUE INDEX IF NOT EXISTS client_accounts_one_internal_per_workspace
  ON public.client_accounts (workspace_id)
  WHERE kind = 'internal';
CREATE UNIQUE INDEX IF NOT EXISTS client_accounts_one_personal_per_user
  ON public.client_accounts (workspace_id, owner_user_id)
  WHERE kind = 'personal';

CREATE INDEX IF NOT EXISTS client_accounts_kind_idx
  ON public.client_accounts (workspace_id, kind);

-- 2. workspace_mode on workspaces (solo / internal_team / client_services)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS workspace_mode text NOT NULL DEFAULT 'client_services';

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_workspace_mode_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_workspace_mode_check
  CHECK (workspace_mode IN ('solo', 'internal_team', 'client_services'));

-- 3. sidebar_pins (per-user pins of clients or projects)
CREATE TABLE IF NOT EXISTS public.sidebar_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('client', 'project')),
  target_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS sidebar_pins_user_ws_idx
  ON public.sidebar_pins (user_id, workspace_id, sort_order);

ALTER TABLE public.sidebar_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own sidebar pins" ON public.sidebar_pins;
CREATE POLICY "Users manage their own sidebar pins"
  ON public.sidebar_pins
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Backfill: ensure one Internal container per existing workspace
INSERT INTO public.client_accounts (workspace_id, name, kind, status, tier)
SELECT w.id, 'Internal', 'internal', 'active', 'standard'
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_accounts c
  WHERE c.workspace_id = w.id AND c.kind = 'internal'
);

-- 5. Backfill: ensure one Personal container per (workspace, member)
INSERT INTO public.client_accounts (workspace_id, name, kind, status, tier, owner_user_id)
SELECT wm.workspace_id, 'My space', 'personal', 'active', 'standard', wm.user_id
FROM public.workspace_members wm
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_accounts c
  WHERE c.workspace_id = wm.workspace_id
    AND c.kind = 'personal'
    AND c.owner_user_id = wm.user_id
);

-- 6. Trigger: auto-create Personal container when a new workspace_member is added
CREATE OR REPLACE FUNCTION public.ensure_personal_container_for_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_accounts (workspace_id, name, kind, status, tier, owner_user_id)
  VALUES (NEW.workspace_id, 'My space', 'personal', 'active', 'standard', NEW.user_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_members_ensure_personal ON public.workspace_members;
CREATE TRIGGER workspace_members_ensure_personal
AFTER INSERT ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.ensure_personal_container_for_member();

-- 7. Trigger: auto-create Internal container when a new workspace is created
CREATE OR REPLACE FUNCTION public.ensure_internal_container_for_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_accounts (workspace_id, name, kind, status, tier)
  VALUES (NEW.id, 'Internal', 'internal', 'active', 'standard')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_ensure_internal ON public.workspaces;
CREATE TRIGGER workspaces_ensure_internal
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.ensure_internal_container_for_workspace();
