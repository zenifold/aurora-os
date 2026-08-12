
-- 1. Templates
CREATE TABLE public.sales_deliverable_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'sow','proposal','discovery_report','tech_architecture','business_case',
    'rfp_response','pricing_options','security_questionnaire',
    'mutual_action_plan','capability_deck','demo_script','custom'
  )),
  name text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  default_model text DEFAULT 'google/gemini-2.5-flash',
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sdt_workspace_kind ON public.sales_deliverable_templates(workspace_id, kind);
ALTER TABLE public.sales_deliverable_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access templates" ON public.sales_deliverable_templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = sales_deliverable_templates.workspace_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = sales_deliverable_templates.workspace_id)
  );

-- 2. Deliverables
CREATE TABLE public.sales_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','internal_review','customer_review','approved','signed','superseded'
  )),
  template_id uuid REFERENCES public.sales_deliverable_templates(id) ON DELETE SET NULL,
  current_version_id uuid,
  owner_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sd_workspace_deal ON public.sales_deliverables(workspace_id, deal_id);
CREATE INDEX idx_sd_kind ON public.sales_deliverables(kind);
ALTER TABLE public.sales_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access deliverables" ON public.sales_deliverables
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = sales_deliverables.workspace_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = sales_deliverables.workspace_id)
  );

-- 3. Versions
CREATE TABLE public.sales_deliverable_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.sales_deliverables(id) ON DELETE CASCADE,
  version integer NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'draft',
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_model text,
  ai_prompt_hash text,
  ai_generated_at timestamptz,
  source_brief_id uuid,
  source_document_ids uuid[] NOT NULL DEFAULT '{}',
  citations jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff_against_prev jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  superseded_by uuid REFERENCES public.sales_deliverable_versions(id) ON DELETE SET NULL,
  UNIQUE(deliverable_id, version)
);
CREATE INDEX idx_sdv_deliverable ON public.sales_deliverable_versions(deliverable_id, version DESC);
ALTER TABLE public.sales_deliverables
  ADD CONSTRAINT sales_deliverables_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.sales_deliverable_versions(id) ON DELETE SET NULL;
ALTER TABLE public.sales_deliverable_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access versions" ON public.sales_deliverable_versions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = sales_deliverable_versions.workspace_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = sales_deliverable_versions.workspace_id)
  );

-- 4. Per-deliverable agent runs (separate from existing public.agent_runs which is a different system)
CREATE TABLE public.deliverable_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_version_id uuid REFERENCES public.sales_deliverable_versions(id) ON DELETE CASCADE,
  deliverable_id uuid REFERENCES public.sales_deliverables(id) ON DELETE CASCADE,
  section_key text,
  model text,
  prompt text,
  input_tokens integer,
  output_tokens integer,
  cost_estimate numeric(10,4),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dar_deliverable ON public.deliverable_agent_runs(deliverable_id, created_at DESC);
CREATE INDEX idx_dar_version ON public.deliverable_agent_runs(deliverable_version_id);
ALTER TABLE public.deliverable_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access deliverable runs" ON public.deliverable_agent_runs
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = deliverable_agent_runs.workspace_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = deliverable_agent_runs.workspace_id)
  );

-- 5. Comments
CREATE TABLE public.deliverable_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.sales_deliverables(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.sales_deliverable_versions(id) ON DELETE SET NULL,
  section_key text,
  range_start integer,
  range_end integer,
  body text NOT NULL,
  parent_id uuid REFERENCES public.deliverable_comments(id) ON DELETE CASCADE,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  author_id uuid NOT NULL,
  author_kind text NOT NULL DEFAULT 'member' CHECK (author_kind IN ('member','customer','guest')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dc_deliverable ON public.deliverable_comments(deliverable_id, created_at DESC);
CREATE INDEX idx_dc_section ON public.deliverable_comments(deliverable_id, section_key);
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access comments" ON public.deliverable_comments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = deliverable_comments.workspace_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = deliverable_comments.workspace_id)
  );

-- 6. Share links
CREATE TABLE public.deliverable_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.sales_deliverables(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.sales_deliverable_versions(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  access text NOT NULL DEFAULT 'read' CHECK (access IN ('read','comment')),
  recipient_email text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dsl_deliverable ON public.deliverable_share_links(deliverable_id);
CREATE INDEX idx_dsl_token ON public.deliverable_share_links(token);
ALTER TABLE public.deliverable_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access share links" ON public.deliverable_share_links
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = deliverable_share_links.workspace_id)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = deliverable_share_links.workspace_id)
  );

-- 7. updated_at triggers
CREATE TRIGGER trg_sdt_updated BEFORE UPDATE ON public.sales_deliverable_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sd_updated BEFORE UPDATE ON public.sales_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dc_updated BEFORE UPDATE ON public.deliverable_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Backfill existing SOW drafts (if table exists)
DO $$
DECLARE
  rec record;
  new_deliverable_id uuid;
  new_version_id uuid;
  sections_json jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sow_drafts') THEN
    FOR rec IN SELECT * FROM public.sow_drafts LOOP
      new_deliverable_id := gen_random_uuid();
      new_version_id := gen_random_uuid();
      sections_json := jsonb_build_object(
        'executive_summary', jsonb_build_object('content', COALESCE(rec.executive_summary, '')),
        'strategy', jsonb_build_object('content', COALESCE(rec.strategy, '')),
        'positioning', jsonb_build_object('content', COALESCE(rec.positioning, '')),
        'value_proposition', jsonb_build_object('content', COALESCE(rec.value_proposition, '')),
        'scope', jsonb_build_object('content', COALESCE(rec.scope, '')),
        'out_of_scope', jsonb_build_object('content', COALESCE(rec.out_of_scope, '')),
        'technical_architecture', jsonb_build_object('content', COALESCE(rec.technical_architecture, '')),
        'integrations_approach', jsonb_build_object('content', COALESCE(rec.integrations_approach, '')),
        'terms_conditions', jsonb_build_object('content', COALESCE(rec.terms_conditions, '')),
        'next_steps', jsonb_build_object('content', COALESCE(rec.next_steps, '')),
        'deliverables', jsonb_build_object('content', COALESCE(rec.deliverables, '[]'::jsonb)),
        'team_composition', jsonb_build_object('content', COALESCE(rec.team_composition, '[]'::jsonb)),
        'timeline', jsonb_build_object('content', COALESCE(rec.timeline, '[]'::jsonb)),
        'financials', jsonb_build_object('content', COALESCE(rec.financials, '{}'::jsonb)),
        'assumptions', jsonb_build_object('content', COALESCE(rec.assumptions, '[]'::jsonb)),
        'risks', jsonb_build_object('content', COALESCE(rec.risks, '[]'::jsonb)),
        'success_criteria', jsonb_build_object('content', COALESCE(rec.success_criteria, '[]'::jsonb))
      );
      INSERT INTO public.sales_deliverables (id, workspace_id, deal_id, kind, title, status, created_by, created_at, updated_at)
      VALUES (
        new_deliverable_id, rec.workspace_id, rec.deal_id, 'sow',
        COALESCE(rec.title, 'Statement of Work'),
        CASE rec.status
          WHEN 'signed' THEN 'signed'
          WHEN 'approved' THEN 'approved'
          WHEN 'customer_review' THEN 'customer_review'
          WHEN 'internal_review' THEN 'internal_review'
          WHEN 'superseded' THEN 'superseded'
          ELSE 'draft'
        END,
        NULL, rec.created_at, rec.updated_at
      );
      INSERT INTO public.sales_deliverable_versions (
        id, workspace_id, deliverable_id, version, status, sections,
        ai_generated_at, source_brief_id, created_at
      )
      VALUES (
        new_version_id, rec.workspace_id, new_deliverable_id, COALESCE(rec.version, 1),
        'draft', sections_json, rec.ai_generated_at, rec.brief_id, rec.created_at
      );
      UPDATE public.sales_deliverables SET current_version_id = new_version_id WHERE id = new_deliverable_id;
    END LOOP;
  END IF;
END $$;
