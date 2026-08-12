
-- Extend page_revisions for versioning
ALTER TABLE public.page_revisions
  ADD COLUMN IF NOT EXISTS version_number int,
  ADD COLUMN IF NOT EXISTS version_label text,
  ADD COLUMN IF NOT EXISTS parent_version_id uuid REFERENCES public.page_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_by_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_prompt text,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS changes_summary text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived'));

CREATE INDEX IF NOT EXISTS idx_page_revisions_workspace ON public.page_revisions(workspace_id);

-- Auto-assign sequential version_number per page
CREATE OR REPLACE FUNCTION public.page_revisions_assign_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
      FROM public.page_revisions WHERE page_id = NEW.page_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_page_revisions_assign_version ON public.page_revisions;
CREATE TRIGGER trg_page_revisions_assign_version
  BEFORE INSERT ON public.page_revisions
  FOR EACH ROW EXECUTE FUNCTION public.page_revisions_assign_version();

-- AI chat threads per page+user
CREATE TABLE IF NOT EXISTS public.page_ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_ai_threads_page_user ON public.page_ai_threads(page_id, user_id);

ALTER TABLE public.page_ai_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_ai_threads_select_own"
  ON public.page_ai_threads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "page_ai_threads_insert_own"
  ON public.page_ai_threads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "page_ai_threads_update_own"
  ON public.page_ai_threads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "page_ai_threads_delete_own"
  ON public.page_ai_threads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_page_ai_threads_touch
  BEFORE UPDATE ON public.page_ai_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- AI suggestions queue
CREATE TABLE IF NOT EXISTS public.page_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.page_revisions(id) ON DELETE SET NULL,
  suggestion_type text NOT NULL CHECK (suggestion_type IN (
    'rewrite','expand','condense','restructure','tone_shift',
    'fact_check','grammar','add_section','remove_section','merge','toc','custom'
  )),
  original_text text,
  proposed_text text,
  proposed_content jsonb,
  explanation text,
  position_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','superseded')),
  created_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_ai_suggestions_page ON public.page_ai_suggestions(page_id, status, created_at DESC);

ALTER TABLE public.page_ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_ai_suggestions_select_members"
  ON public.page_ai_suggestions FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "page_ai_suggestions_insert_members"
  ON public.page_ai_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "page_ai_suggestions_update_members"
  ON public.page_ai_suggestions FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "page_ai_suggestions_delete_members"
  ON public.page_ai_suggestions FOR DELETE
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
