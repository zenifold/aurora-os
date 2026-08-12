
-- 1. SCAN HISTORY ------------------------------------------------------------
CREATE TABLE public.sales_document_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  ai_summary TEXT,
  ai_extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb, -- { field_key: 0.0..1.0 }
  overall_confidence NUMERIC(3,2),
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,        -- { field_key: {before, after, change: added|removed|changed|unchanged} }
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  scanned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_doc_scans_doc ON public.sales_document_scans(document_id, version DESC);
CREATE UNIQUE INDEX idx_sales_doc_scans_doc_version ON public.sales_document_scans(document_id, version);

ALTER TABLE public.sales_document_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read sales_document_scans"
ON public.sales_document_scans FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = sales_document_scans.workspace_id AND wm.user_id = auth.uid()
));
CREATE POLICY "Workspace members insert sales_document_scans"
ON public.sales_document_scans FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = sales_document_scans.workspace_id AND wm.user_id = auth.uid()
));

-- Track the current/latest version on the document itself
ALTER TABLE public.sales_documents
  ADD COLUMN IF NOT EXISTS scan_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_scan_confidence NUMERIC(3,2);

-- 2. DISCOVERY BRIEF CITATIONS ----------------------------------------------
ALTER TABLE public.discovery_briefs
  ADD COLUMN IF NOT EXISTS citations JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Shape: { field_key: [{ document_id: uuid, snippet: text, section: text|null, confidence: number|null }] }

-- 3. SCOPE CHECKLIST --------------------------------------------------------
CREATE TABLE public.scope_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  brief_id UUID REFERENCES public.discovery_briefs(id) ON DELETE SET NULL,
  sow_id UUID REFERENCES public.sow_drafts(id) ON DELETE SET NULL,
  area TEXT NOT NULL,                        -- functional area (auth, payments, ai, infra, ...)
  requirement TEXT NOT NULL,                 -- the requirement itself
  details TEXT,                              -- optional clarifying notes
  status TEXT NOT NULL DEFAULT 'in_scope',   -- in_scope | out_of_scope | deferred | needs_clarification | done
  priority TEXT NOT NULL DEFAULT 'must_have',-- must_have | should_have | nice_to_have
  confidence NUMERIC(3,2),
  source_document_id UUID REFERENCES public.sales_documents(id) ON DELETE SET NULL,
  source_snippet TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  applied_to_sow_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scope_items_deal ON public.scope_checklist_items(deal_id);
CREATE INDEX idx_scope_items_brief ON public.scope_checklist_items(brief_id);
CREATE INDEX idx_scope_items_workspace ON public.scope_checklist_items(workspace_id);

ALTER TABLE public.scope_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read scope_checklist_items"
ON public.scope_checklist_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = scope_checklist_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "Workspace members insert scope_checklist_items"
ON public.scope_checklist_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = scope_checklist_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "Workspace members update scope_checklist_items"
ON public.scope_checklist_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = scope_checklist_items.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "Workspace members delete scope_checklist_items"
ON public.scope_checklist_items FOR DELETE
USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = scope_checklist_items.workspace_id AND wm.user_id = auth.uid()));

CREATE TRIGGER update_scope_checklist_items_updated_at
BEFORE UPDATE ON public.scope_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
