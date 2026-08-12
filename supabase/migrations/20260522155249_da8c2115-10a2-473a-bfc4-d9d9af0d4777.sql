
-- Sales-stage document center: deal-scoped documents uploaded pre-handover (RFPs, transcripts, decks, contracts, requirements docs, screenshots).
CREATE TABLE IF NOT EXISTS public.sales_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  document_type text NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('rfp','spec','transcript','deck','email','contract','wireframe','reference','screenshot','requirements','other')),
  source text NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload','email','link','meeting','manual_note')),
  storage_path text,
  external_url text,
  file_size_bytes bigint,
  mime_type text,
  raw_text text,
  ai_summary text,
  ai_extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_scanned_at timestamptz,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_documents_deal ON public.sales_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_documents_workspace ON public.sales_documents(workspace_id);

ALTER TABLE public.sales_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_documents_select_members" ON public.sales_documents FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "sales_documents_insert_members" ON public.sales_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "sales_documents_update_members" ON public.sales_documents FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "sales_documents_delete_members" ON public.sales_documents FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER set_sales_documents_updated_at BEFORE UPDATE ON public.sales_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend discovery_briefs with structured fields for technical requirements, integrations, platforms, etc.
ALTER TABLE public.discovery_briefs
  ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS integrations text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS key_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS technical_requirements text,
  ADD COLUMN IF NOT EXISTS non_functional_requirements text,
  ADD COLUMN IF NOT EXISTS compliance_requirements text,
  ADD COLUMN IF NOT EXISTS budget_min numeric(12,2),
  ADD COLUMN IF NOT EXISTS budget_max numeric(12,2),
  ADD COLUMN IF NOT EXISTS budget_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS timeline_weeks integer,
  ADD COLUMN IF NOT EXISTS desired_start_date date,
  ADD COLUMN IF NOT EXISTS desired_launch_date date,
  ADD COLUMN IF NOT EXISTS stakeholders jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_document_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Storage bucket for sales-stage documents (private).
INSERT INTO storage.buckets (id, name, public)
VALUES ('sales-documents', 'sales-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: workspace members can read/write objects whose first path segment is their workspace_id.
CREATE POLICY "sales_docs_select_members" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sales-documents'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "sales_docs_insert_members" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sales-documents'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "sales_docs_update_members" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sales-documents'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "sales_docs_delete_members" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sales-documents'
    AND public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
