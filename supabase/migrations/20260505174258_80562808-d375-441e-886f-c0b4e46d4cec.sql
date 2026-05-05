
-- Storage bucket for client deliverable file uploads (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-deliverables', 'client-deliverables', false)
ON CONFLICT (id) DO NOTHING;

-- Workspace members can read deliverable files
CREATE POLICY "client_deliv_files_select_members"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-deliverables'
  AND public.is_workspace_member(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- Workspace members can delete deliverable files
CREATE POLICY "client_deliv_files_delete_members"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-deliverables'
  AND public.is_workspace_member(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);
