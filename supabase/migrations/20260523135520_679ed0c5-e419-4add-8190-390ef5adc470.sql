-- 1. Extend pages with document/template metadata
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS doc_kind text,
  ADD COLUMN IF NOT EXISTS doc_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS template_source_id uuid REFERENCES public.pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_kit_id uuid,
  ADD COLUMN IF NOT EXISTS client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pages_client_account ON public.pages(client_account_id) WHERE client_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pages_doc_kind ON public.pages(workspace_id, doc_kind) WHERE doc_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pages_templates ON public.pages(workspace_id, doc_kind) WHERE is_template = true;

-- 2. Brand kits
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Brand kit',
  logo_url text,
  cover_url text,
  primary_color text DEFAULT '#0F172A',
  accent_color text DEFAULT '#6366F1',
  text_color text DEFAULT '#0F172A',
  font_heading text DEFAULT 'Inter',
  font_body text DEFAULT 'Inter',
  footer_text text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_workspace ON public.brand_kits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_kits_client ON public.brand_kits(client_account_id) WHERE client_account_id IS NOT NULL;

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_kits_select_members ON public.brand_kits FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY brand_kits_insert_members ON public.brand_kits FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY brand_kits_update_members ON public.brand_kits FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY brand_kits_delete_members ON public.brand_kits FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER brand_kits_set_updated_at BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Add FK from pages.brand_kit_id (added after brand_kits exists)
ALTER TABLE public.pages
  ADD CONSTRAINT pages_brand_kit_fk FOREIGN KEY (brand_kit_id)
  REFERENCES public.brand_kits(id) ON DELETE SET NULL;

-- 4. Seed a library of system templates, one per workspace, for new doc_kinds.
--    We attach them to every existing workspace and mark is_template=true.
INSERT INTO public.pages (workspace_id, scope, title, icon, page_type, is_template, doc_kind, content, content_text)
SELECT w.id, 'workspace', t.title, t.icon, 'doc', true, t.kind,
  jsonb_build_object(
    'type','doc',
    'content', jsonb_build_array(
      jsonb_build_object('type','heading','attrs',jsonb_build_object('level',1),'content',jsonb_build_array(jsonb_build_object('type','text','text', t.title))),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text', t.intro))),
      jsonb_build_object('type','heading','attrs',jsonb_build_object('level',2),'content',jsonb_build_array(jsonb_build_object('type','text','text','Overview'))),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Describe the context, goals, and key parties.'))),
      jsonb_build_object('type','heading','attrs',jsonb_build_object('level',2),'content',jsonb_build_array(jsonb_build_object('type','text','text','Details'))),
      jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Fill in the specifics for this engagement.')))
    )
  )::jsonb,
  t.title || ' ' || t.intro
FROM public.workspaces w
CROSS JOIN (
  VALUES
    ('Proposal', '💼', 'proposal', 'A persuasive overview of the proposed engagement, value, and next steps.'),
    ('Statement of Work', '📜', 'sow', 'Scope, deliverables, timeline, and commercials for a specific engagement.'),
    ('Master Services Agreement', '⚖️', 'contract', 'The legal framework governing the working relationship.'),
    ('Project Brief', '🎯', 'brief', 'A concise summary of objectives, audience, constraints, and success criteria.'),
    ('Meeting Recap', '🎤', 'recap', 'Summary of the conversation, decisions, and action items.'),
    ('Status Report', '📊', 'status_report', 'Current state of the engagement: progress, risks, and what is next.'),
    ('Case Study', '🏆', 'case_study', 'How a past engagement created measurable impact for the client.')
) AS t(title, icon, kind, intro)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pages p
  WHERE p.workspace_id = w.id AND p.is_template = true AND p.doc_kind = t.kind
);