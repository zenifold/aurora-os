
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS thread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thread_last_reply_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_channel_messages_parent
  ON public.channel_messages(parent_message_id)
  WHERE parent_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.channel_messages_thread_count_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_message_id IS NOT NULL THEN
      UPDATE public.channel_messages
        SET thread_count = thread_count + 1,
            thread_last_reply_at = NEW.created_at
        WHERE id = NEW.parent_message_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- soft-delete: when deleted_at goes from null -> not null, decrement
    IF NEW.parent_message_id IS NOT NULL
       AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE public.channel_messages
        SET thread_count = GREATEST(thread_count - 1, 0)
        WHERE id = NEW.parent_message_id;
    ELSIF NEW.parent_message_id IS NOT NULL
       AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE public.channel_messages
        SET thread_count = thread_count + 1
        WHERE id = NEW.parent_message_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_message_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
      UPDATE public.channel_messages
        SET thread_count = GREATEST(thread_count - 1, 0)
        WHERE id = OLD.parent_message_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS channel_messages_thread_count ON public.channel_messages;
CREATE TRIGGER channel_messages_thread_count
AFTER INSERT OR UPDATE OR DELETE ON public.channel_messages
FOR EACH ROW EXECUTE FUNCTION public.channel_messages_thread_count_trigger();

-- Backfill existing thread counts
UPDATE public.channel_messages p
SET thread_count = sub.cnt,
    thread_last_reply_at = sub.last_at
FROM (
  SELECT parent_message_id, COUNT(*)::int AS cnt, MAX(created_at) AS last_at
  FROM public.channel_messages
  WHERE parent_message_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY parent_message_id
) sub
WHERE p.id = sub.parent_message_id;
