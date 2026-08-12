
-- Storage bucket for general attachments (private — accessed via signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Polymorphic attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('task','comment','meeting','note','page','project')),
  entity_id uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON public.attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_workspace ON public.attachments(workspace_id);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_select_members ON public.attachments
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY attachments_insert_members ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = uploaded_by);

CREATE POLICY attachments_delete_uploader_or_owner ON public.attachments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
  );

-- Storage RLS for attachments bucket: paths are namespaced as {workspace_id}/{entity_type}/{entity_id}/...
CREATE POLICY "attachments_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "attachments_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "attachments_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
