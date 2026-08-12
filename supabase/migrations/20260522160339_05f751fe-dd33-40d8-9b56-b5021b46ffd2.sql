
-- SOW DRAFTS: multi-section, versioned, agentically generated, editable per-section
CREATE TABLE public.sow_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  brief_id UUID REFERENCES public.discovery_briefs(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | internal_review | customer_review | approved | signed | superseded
  title TEXT NOT NULL DEFAULT 'Statement of Work',
  client_name TEXT,
  -- Narrative sections (markdown / plain text)
  executive_summary TEXT DEFAULT '',
  strategy TEXT DEFAULT '',                 -- high-level strategic approach
  positioning TEXT DEFAULT '',              -- why us / differentiators
  value_proposition TEXT DEFAULT '',
  scope TEXT DEFAULT '',
  out_of_scope TEXT DEFAULT '',
  technical_architecture TEXT DEFAULT '',
  integrations_approach TEXT DEFAULT '',
  terms_conditions TEXT DEFAULT '',
  next_steps TEXT DEFAULT '',
  -- Structured sections
  team_composition JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{role,count,allocation_pct,rationale}]
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{name,description,acceptance_criteria}]
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,           -- [{phase,weeks,milestones:[...]}]
  financials JSONB NOT NULL DEFAULT '{}'::jsonb,         -- {line_items,subtotal,discount,total,currency,payment_schedule,notes}
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,        -- string[]
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,              -- [{risk,impact,mitigation}]
  success_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,   -- string[]
  -- Per-section AI metadata (which sections were AI-generated/regenerated and when)
  section_meta JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {section_key: {ai_generated_at, last_instruction}}
  ai_generated_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sow_drafts_deal ON public.sow_drafts(deal_id);
CREATE INDEX idx_sow_drafts_workspace ON public.sow_drafts(workspace_id);
CREATE UNIQUE INDEX idx_sow_drafts_deal_version ON public.sow_drafts(deal_id, version);

ALTER TABLE public.sow_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read sow_drafts"
ON public.sow_drafts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = sow_drafts.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Workspace members insert sow_drafts"
ON public.sow_drafts FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = sow_drafts.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Workspace members update sow_drafts"
ON public.sow_drafts FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = sow_drafts.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Workspace members delete sow_drafts"
ON public.sow_drafts FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.workspace_members wm
  WHERE wm.workspace_id = sow_drafts.workspace_id AND wm.user_id = auth.uid()
));

CREATE TRIGGER update_sow_drafts_updated_at
BEFORE UPDATE ON public.sow_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
