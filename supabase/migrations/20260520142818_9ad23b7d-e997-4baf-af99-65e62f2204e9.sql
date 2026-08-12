
-- ============================================================
-- BLOCK A · Phase 1 — No-code object model foundation
-- ============================================================

-- 1. OBJECT TYPES REGISTRY -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.object_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  plural_label TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  description TEXT,
  system_kind TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  default_view_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE INDEX IF NOT EXISTS idx_object_types_workspace ON public.object_types(workspace_id, sort_order);

ALTER TABLE public.object_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view object types"
  ON public.object_types FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "managers insert object types"
  ON public.object_types FOR INSERT
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id) AND
    (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
     OR public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role))
  );

CREATE POLICY "managers update object types"
  ON public.object_types FOR UPDATE
  USING (
    public.is_workspace_member(auth.uid(), workspace_id) AND
    (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
     OR public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role))
  );

CREATE POLICY "managers delete non-system object types"
  ON public.object_types FOR DELETE
  USING (
    is_system = false AND
    (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
     OR public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role))
  );

CREATE TRIGGER trg_object_types_updated_at
  BEFORE UPDATE ON public.object_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. SEED DEFAULTS -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_object_types(_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.object_types (workspace_id, key, label, plural_label, icon, color, system_kind, is_system, sort_order, description)
  VALUES
    (_workspace_id, 'task',     'Task',       'Tasks',        'check-square',  '#3b82f6', 'task',    true, 0, 'Unit of work assigned to a person.'),
    (_workspace_id, 'project',  'Project',    'Projects',     'briefcase',     '#8b5cf6', 'project', true, 1, 'Container for delivery work.'),
    (_workspace_id, 'note',     'Note',       'Notes',        'sticky-note',   '#f59e0b', 'note',    true, 2, 'Free-form thought, doc, or jotting.'),
    (_workspace_id, 'meeting',  'Meeting',    'Meetings',     'video',         '#10b981', 'meeting', true, 3, 'Scheduled conversation with transcript.'),
    (_workspace_id, 'contact',  'Contact',    'Contacts',     'user-round',    '#ec4899', 'contact', true, 4, 'Person or company in your network.'),
    (_workspace_id, 'risk',     'Risk',       'Risks',        'alert-triangle','#ef4444', 'raid',    true, 5, 'Risk / Assumption / Issue / Decision.'),
    (_workspace_id, 'intake',   'Intake form','Intake forms', 'clipboard-list','#0ea5e9', 'intake',  true, 6, 'Structured client questionnaire.')
  ON CONFLICT (workspace_id, key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspaces_seed_object_types_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_object_types(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspaces_seed_object_types ON public.workspaces;
CREATE TRIGGER trg_workspaces_seed_object_types
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.workspaces_seed_object_types_trigger();

DO $$
DECLARE
  ws_row RECORD;
BEGIN
  FOR ws_row IN SELECT id FROM public.workspaces LOOP
    PERFORM public.seed_default_object_types(ws_row.id);
  END LOOP;
END $$;

-- 3. EXTEND custom_field_defs --------------------------------------------------
ALTER TABLE public.custom_field_defs
  ADD COLUMN IF NOT EXISTS object_type_id UUID REFERENCES public.object_types(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS help_text TEXT,
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_visible_in_table BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS formula_expr TEXT,
  ADD COLUMN IF NOT EXISTS rollup_config JSONB,
  ADD COLUMN IF NOT EXISTS lookup_config JSONB,
  ADD COLUMN IF NOT EXISTS default_value JSONB;

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_object_type ON public.custom_field_defs(object_type_id);

-- 4. CUSTOM RECORDS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  object_type_id UUID NOT NULL REFERENCES public.object_types(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT,
  owner_id UUID,
  parent_record_id UUID REFERENCES public.custom_records(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  tags TEXT[],
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_records_workspace_type ON public.custom_records(workspace_id, object_type_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_custom_records_owner ON public.custom_records(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_records_project ON public.custom_records(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_records_values ON public.custom_records USING gin(values);

ALTER TABLE public.custom_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view records"
  ON public.custom_records FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "members create records"
  ON public.custom_records FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "members update records"
  ON public.custom_records FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "members delete records"
  ON public.custom_records FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER trg_custom_records_updated_at
  BEFORE UPDATE ON public.custom_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. CUSTOM RECORD RELATIONS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_record_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  from_record_id UUID NOT NULL REFERENCES public.custom_records(id) ON DELETE CASCADE,
  to_record_id UUID NOT NULL REFERENCES public.custom_records(id) ON DELETE CASCADE,
  relation_key TEXT NOT NULL DEFAULT 'relates_to',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_record_id, to_record_id, relation_key)
);

CREATE INDEX IF NOT EXISTS idx_crr_from ON public.custom_record_relations(from_record_id);
CREATE INDEX IF NOT EXISTS idx_crr_to ON public.custom_record_relations(to_record_id);

ALTER TABLE public.custom_record_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view relations"
  ON public.custom_record_relations FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "members create relations"
  ON public.custom_record_relations FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "members delete relations"
  ON public.custom_record_relations FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- 6. EXTEND user_saved_views ---------------------------------------------------
ALTER TABLE public.user_saved_views
  ADD COLUMN IF NOT EXISTS object_type_id UUID REFERENCES public.object_types(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS view_kind TEXT NOT NULL DEFAULT 'table',
  ADD COLUMN IF NOT EXISTS group_by TEXT,
  ADD COLUMN IF NOT EXISTS visible_fields TEXT[],
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT;

DROP POLICY IF EXISTS "members view shared saved views" ON public.user_saved_views;
CREATE POLICY "members view shared saved views"
  ON public.user_saved_views FOR SELECT
  USING (
    is_shared = true AND public.is_workspace_member(auth.uid(), workspace_id)
  );

CREATE INDEX IF NOT EXISTS idx_saved_views_object_type ON public.user_saved_views(object_type_id) WHERE object_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_views_shared ON public.user_saved_views(workspace_id, is_shared) WHERE is_shared = true;
