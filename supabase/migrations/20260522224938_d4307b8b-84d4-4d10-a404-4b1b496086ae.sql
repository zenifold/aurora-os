
-- =========================
-- Client Request Bundles
-- =========================
CREATE TABLE public.client_request_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','completed','archived')),
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  recipient_name TEXT,
  recipient_email TEXT,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  ai_summary TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crb_client ON public.client_request_bundles(client_account_id);
CREATE INDEX idx_crb_workspace ON public.client_request_bundles(workspace_id);
CREATE INDEX idx_crb_token ON public.client_request_bundles(share_token);

ALTER TABLE public.client_request_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read bundles" ON public.client_request_bundles
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members insert bundles" ON public.client_request_bundles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members update bundles" ON public.client_request_bundles
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members delete bundles" ON public.client_request_bundles
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =========================
-- Items
-- =========================
CREATE TABLE public.client_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES public.client_request_bundles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL DEFAULT 'file' CHECK (item_type IN ('file','text','decision','link')),
  is_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  response_text TEXT,
  response_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_decision TEXT,
  response_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','skipped')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cri_bundle ON public.client_request_items(bundle_id);

ALTER TABLE public.client_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read items" ON public.client_request_items
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members insert items" ON public.client_request_items
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members update items" ON public.client_request_items
  FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members delete items" ON public.client_request_items
  FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- =========================
-- Activity log
-- =========================
CREATE TABLE public.client_request_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES public.client_request_bundles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agency','customer','system','ai')),
  actor_name TEXT,
  event TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cra_bundle ON public.client_request_activity(bundle_id);

ALTER TABLE public.client_request_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read activity" ON public.client_request_activity
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "members insert activity" ON public.client_request_activity
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- =========================
-- updated_at triggers
-- =========================
CREATE TRIGGER trg_crb_updated BEFORE UPDATE ON public.client_request_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cri_updated BEFORE UPDATE ON public.client_request_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- Public lookup by share token (used by customer-facing /r/$token)
-- =========================
CREATE OR REPLACE FUNCTION public.get_client_request_bundle_by_token(_token TEXT)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  client_account_id UUID,
  project_id UUID,
  title TEXT,
  instructions TEXT,
  due_date DATE,
  status TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  account_name TEXT,
  items JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    b.id, b.workspace_id, b.client_account_id, b.project_id,
    b.title, b.instructions, b.due_date, b.status,
    b.recipient_name, b.recipient_email, b.sent_at, b.completed_at,
    a.name AS account_name,
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.sort_order, i.created_at)
       FROM public.client_request_items i WHERE i.bundle_id = b.id),
      '[]'::jsonb
    ) AS items
  FROM public.client_request_bundles b
  JOIN public.client_accounts a ON a.id = b.client_account_id
  WHERE b.share_token = _token AND b.status <> 'archived';
$$;

GRANT EXECUTE ON FUNCTION public.get_client_request_bundle_by_token(TEXT) TO anon, authenticated;

-- Public submit function — updates items + bundle when customer submits
CREATE OR REPLACE FUNCTION public.submit_client_request_item(
  _token TEXT,
  _item_id UUID,
  _response_text TEXT DEFAULT NULL,
  _response_decision TEXT DEFAULT NULL,
  _response_link TEXT DEFAULT NULL,
  _response_files JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bundle_id UUID;
  v_workspace_id UUID;
BEGIN
  SELECT b.id, b.workspace_id INTO v_bundle_id, v_workspace_id
  FROM public.client_request_bundles b
  JOIN public.client_request_items i ON i.bundle_id = b.id
  WHERE b.share_token = _token AND i.id = _item_id AND b.status <> 'archived'
  LIMIT 1;

  IF v_bundle_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.client_request_items
  SET response_text = COALESCE(_response_text, response_text),
      response_decision = COALESCE(_response_decision, response_decision),
      response_link = COALESCE(_response_link, response_link),
      response_files = COALESCE(_response_files, response_files),
      status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  WHERE id = _item_id;

  INSERT INTO public.client_request_activity(bundle_id, workspace_id, actor_type, event, detail)
  VALUES (v_bundle_id, v_workspace_id, 'customer', 'item_submitted', jsonb_build_object('item_id', _item_id));

  -- update bundle rollup status
  UPDATE public.client_request_bundles b
  SET status = CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.client_request_items WHERE bundle_id = b.id AND status = 'pending' AND is_required)
          THEN 'completed'
        ELSE 'partial'
      END,
      completed_at = CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.client_request_items WHERE bundle_id = b.id AND status = 'pending' AND is_required)
          THEN now() ELSE b.completed_at
      END,
      updated_at = now()
  WHERE b.id = v_bundle_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_client_request_item(TEXT, UUID, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- =========================
-- Storage bucket
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-request-uploads', 'client-request-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Workspace members can read all files in this bucket scoped via path prefix = bundle_id
CREATE POLICY "members read request uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-request-uploads'
    AND EXISTS (
      SELECT 1 FROM public.client_request_bundles b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), b.workspace_id)
    )
  );

CREATE POLICY "members write request uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-request-uploads'
    AND EXISTS (
      SELECT 1 FROM public.client_request_bundles b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), b.workspace_id)
    )
  );

-- Anonymous customer can upload to a bundle folder (path = "<bundle_id>/...") for any non-archived bundle
CREATE POLICY "anon upload request files" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'client-request-uploads'
    AND EXISTS (
      SELECT 1 FROM public.client_request_bundles b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.status <> 'archived'
    )
  );

CREATE POLICY "anon read request files" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'client-request-uploads'
    AND EXISTS (
      SELECT 1 FROM public.client_request_bundles b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.status <> 'archived'
    )
  );
