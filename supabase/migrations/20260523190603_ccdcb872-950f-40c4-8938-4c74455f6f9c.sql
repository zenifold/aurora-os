
-- 1. attachments bucket: add UPDATE policy (workspace-member scoped)
CREATE POLICY "attachments_storage_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
WITH CHECK (bucket_id = 'attachments' AND is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- 2 & 3. Remove anon access to client-request-uploads bucket; require authenticated workspace members
DROP POLICY IF EXISTS "anon read request files" ON storage.objects;
DROP POLICY IF EXISTS "anon upload request files" ON storage.objects;

CREATE POLICY "auth read request files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-request-uploads'
  AND EXISTS (
    SELECT 1 FROM client_request_bundles b
    WHERE (b.id)::text = (storage.foldername(objects.name))[1]
      AND b.status <> 'archived'
      AND is_workspace_member(auth.uid(), b.workspace_id)
  )
);

CREATE POLICY "auth upload request files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-request-uploads'
  AND EXISTS (
    SELECT 1 FROM client_request_bundles b
    WHERE (b.id)::text = (storage.foldername(objects.name))[1]
      AND b.status <> 'archived'
      AND is_workspace_member(auth.uid(), b.workspace_id)
  )
);

-- 4. entity_links: fix swapped argument order on is_workspace_member
DROP POLICY IF EXISTS "entity_links workspace members read"   ON public.entity_links;
DROP POLICY IF EXISTS "entity_links workspace members insert" ON public.entity_links;
DROP POLICY IF EXISTS "entity_links workspace members update" ON public.entity_links;
DROP POLICY IF EXISTS "entity_links workspace members delete" ON public.entity_links;

CREATE POLICY "entity_links workspace members read"
ON public.entity_links FOR SELECT TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "entity_links workspace members insert"
ON public.entity_links FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "entity_links workspace members update"
ON public.entity_links FOR UPDATE TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "entity_links workspace members delete"
ON public.entity_links FOR DELETE TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id));

-- 5. profiles: drop USING(true) policy; keep shared-workspace policy
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
