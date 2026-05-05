-- ============================================================
-- RESOURCES (contractors, AI agents, vendors — separate from team_members)
-- ============================================================
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'contractor' CHECK (type IN ('contractor','ai_agent','vendor','external')),
  user_id UUID,
  email TEXT,
  avatar_url TEXT,
  role TEXT,
  department TEXT,
  start_date DATE,
  end_date DATE,
  weekly_capacity_hours INTEGER NOT NULL DEFAULT 40,
  daily_capacity_hours INTEGER NOT NULL DEFAULT 8,
  timezone TEXT DEFAULT 'UTC',
  work_schedule JSONB NOT NULL DEFAULT '{"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":8,"saturday":0,"sunday":0}'::jsonb,
  cost_rate_currency TEXT NOT NULL DEFAULT 'USD',
  cost_rate_amount NUMERIC(10,2),
  cost_rate_period TEXT DEFAULT 'hourly' CHECK (cost_rate_period IN ('hourly','daily','monthly','yearly')),
  billable BOOLEAN NOT NULL DEFAULT true,
  bill_rate_currency TEXT NOT NULL DEFAULT 'USD',
  bill_rate_amount NUMERIC(10,2),
  bill_rate_period TEXT DEFAULT 'hourly' CHECK (bill_rate_period IN ('hourly','daily','fixed')),
  skills TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resources_workspace ON public.resources(workspace_id);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resources_select_members" ON public.resources
  FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "resources_insert_members" ON public.resources
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "resources_update_members" ON public.resources
  FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "resources_delete_members" ON public.resources
  FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER resources_touch_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RESOURCE ALLOCATIONS
-- Polymorphic: can target a team_members row OR a resources row
-- ============================================================
CREATE TABLE public.resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  -- Either team_member_user_id OR resource_id is set
  team_member_user_id UUID,
  resource_id UUID,
  allocation_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (allocation_type IN ('fixed_hours','percentage','full_time','scheduled_hours')),
  percentage INTEGER CHECK (percentage IS NULL OR (percentage BETWEEN 0 AND 200)),
  fixed_hours NUMERIC(10,2),
  scheduled_hours JSONB,
  start_date DATE NOT NULL,
  end_date DATE,
  billable BOOLEAN NOT NULL DEFAULT true,
  bill_rate_override NUMERIC(10,2),
  cost_rate_override NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','cancelled')),
  actual_hours_logged NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT allocation_target_one CHECK (
    (team_member_user_id IS NOT NULL AND resource_id IS NULL) OR
    (team_member_user_id IS NULL AND resource_id IS NOT NULL)
  )
);

CREATE INDEX idx_alloc_project ON public.resource_allocations(project_id);
CREATE INDEX idx_alloc_workspace ON public.resource_allocations(workspace_id);
CREATE INDEX idx_alloc_resource ON public.resource_allocations(resource_id);
CREATE INDEX idx_alloc_team_member ON public.resource_allocations(team_member_user_id);
CREATE INDEX idx_alloc_dates ON public.resource_allocations(start_date, end_date);

ALTER TABLE public.resource_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocations_select_members" ON public.resource_allocations
  FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "allocations_insert_members" ON public.resource_allocations
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "allocations_update_members" ON public.resource_allocations
  FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "allocations_delete_members" ON public.resource_allocations
  FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER allocations_touch_updated_at
  BEFORE UPDATE ON public.resource_allocations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RESOURCE UNAVAILABILITY (PTO, holidays, sick, bench)
-- ============================================================
CREATE TABLE public.resource_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  team_member_user_id UUID,
  resource_id UUID,
  type TEXT NOT NULL DEFAULT 'pto' CHECK (type IN ('pto','sick','holiday','training','bench','other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 8,
  approved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unavailability_target_one CHECK (
    (team_member_user_id IS NOT NULL AND resource_id IS NULL) OR
    (team_member_user_id IS NULL AND resource_id IS NOT NULL)
  )
);

CREATE INDEX idx_unavail_workspace ON public.resource_unavailability(workspace_id);
CREATE INDEX idx_unavail_dates ON public.resource_unavailability(start_date, end_date);

ALTER TABLE public.resource_unavailability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unavail_select_members" ON public.resource_unavailability
  FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "unavail_insert_members" ON public.resource_unavailability
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "unavail_update_members" ON public.resource_unavailability
  FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "unavail_delete_members" ON public.resource_unavailability
  FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

-- ============================================================
-- PROJECT DOCUMENTS (SOWs, contracts, etc.)
-- ============================================================
CREATE TABLE public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('sow','contract','msa','amendment','proposal','invoice','timesheet','legal','compliance','other')),
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID,
  contract_value NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client','public')),
  requires_nda BOOLEAN NOT NULL DEFAULT false,
  signature_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (signature_status IN ('draft','sent','viewed','signed','expired','declined','not_required')),
  signed_at TIMESTAMPTZ,
  signed_by UUID,
  effective_date DATE,
  expiration_date DATE,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_project ON public.project_documents(project_id);
CREATE INDEX idx_documents_workspace ON public.project_documents(workspace_id);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_members" ON public.project_documents
  FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "documents_insert_members" ON public.project_documents
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "documents_update_members" ON public.project_documents
  FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "documents_delete_members" ON public.project_documents
  FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER documents_touch_updated_at
  BEFORE UPDATE ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- STORAGE BUCKET for documents (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Path layout: {workspace_id}/{project_id|_workspace}/{doc_id}-{filename}
-- First folder segment = workspace_id; gate access on membership
CREATE POLICY "project_docs_select_members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "project_docs_insert_members" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
    AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "project_docs_update_members" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "project_docs_delete_members" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );