
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'workspace',
  scope_id UUID,
  parent_page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  cover_url TEXT,
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  content_text TEXT NOT NULL DEFAULT '',
  page_type TEXT NOT NULL DEFAULT 'doc',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_template BOOLEAN NOT NULL DEFAULT false,
  ai_managed BOOLEAN NOT NULL DEFAULT false,
  ai_last_summarized_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pages_workspace ON public.pages(workspace_id);
CREATE INDEX idx_pages_scope ON public.pages(workspace_id, scope, scope_id);
CREATE INDEX idx_pages_parent ON public.pages(parent_page_id);
CREATE INDEX idx_pages_fts ON public.pages USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_text,'')));

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY pages_select_members ON public.pages FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY pages_insert_members ON public.pages FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY pages_update_members ON public.pages FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id)) WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY pages_delete_members ON public.pages FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER pages_set_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.page_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  edited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_page_revisions_page ON public.page_revisions(page_id, created_at DESC);
ALTER TABLE public.page_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY page_revisions_select_members ON public.page_revisions FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY page_revisions_insert_members ON public.page_revisions FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE public.page_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  source_page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  target_page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  target_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_page_links_source ON public.page_links(source_page_id);
CREATE INDEX idx_page_links_target_page ON public.page_links(target_page_id);
CREATE INDEX idx_page_links_target_task ON public.page_links(target_task_id);
ALTER TABLE public.page_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY page_links_select_members ON public.page_links FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY page_links_insert_members ON public.page_links FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY page_links_delete_members ON public.page_links FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
