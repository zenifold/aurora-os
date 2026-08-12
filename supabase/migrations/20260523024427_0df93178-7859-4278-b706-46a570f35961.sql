-- Universal polymorphic entity linking
-- Lets any object (task, project, deal, contact, invoice, page, note, meeting, etc.)
-- relate to any other object in the workspace.

CREATE TABLE IF NOT EXISTS public.entity_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  from_kind TEXT NOT NULL,
  from_id UUID NOT NULL,
  to_kind TEXT NOT NULL,
  to_id UUID NOT NULL,
  relation TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT entity_links_no_self CHECK (NOT (from_kind = to_kind AND from_id = to_id)),
  CONSTRAINT entity_links_unique UNIQUE (workspace_id, from_kind, from_id, to_kind, to_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_from ON public.entity_links (workspace_id, from_kind, from_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_to ON public.entity_links (workspace_id, to_kind, to_id);

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_links workspace members read"
  ON public.entity_links FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "entity_links workspace members insert"
  ON public.entity_links FOR INSERT
  WITH CHECK (
    public.is_workspace_member(workspace_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "entity_links workspace members update"
  ON public.entity_links FOR UPDATE
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "entity_links workspace members delete"
  ON public.entity_links FOR DELETE
  USING (public.is_workspace_member(workspace_id, auth.uid()));
