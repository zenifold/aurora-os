-- Comments 2.0 columns
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Allow workspace members (not just author) to update reactions / resolve.
-- We keep the author-only update policy and add a separate policy for resolve+react.
DROP POLICY IF EXISTS comments_update_members_meta ON public.comments;
CREATE POLICY comments_update_members_meta
ON public.comments
FOR UPDATE
TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- Enable realtime broadcasts for comments
ALTER TABLE public.comments REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.comments';
  END IF;
END $$;

-- Trigger: notify mentioned users
CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  mentioned_id uuid;
  task_title text;
  task_project uuid;
begin
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title, project_id INTO task_title, task_project
  FROM public.tasks WHERE id = NEW.task_id;

  FOREACH mentioned_id IN ARRAY NEW.mentions LOOP
    IF mentioned_id IS NULL OR mentioned_id = NEW.author_id THEN CONTINUE; END IF;
    INSERT INTO public.notifications
      (workspace_id, recipient_id, actor_id, type, title, body, link, task_id, project_id, comment_id)
    VALUES (
      NEW.workspace_id,
      mentioned_id,
      NEW.author_id,
      'mention',
      'You were mentioned',
      coalesce(task_title, 'a task'),
      '/app/p/' || coalesce(task_project::text, ''),
      NEW.task_id,
      task_project,
      NEW.id
    );
  END LOOP;
  RETURN NEW;
end;
$$;

DROP TRIGGER IF EXISTS comments_notify_mentions ON public.comments;
CREATE TRIGGER comments_notify_mentions
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_mentions();