
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_recipient_inbox_idx
  ON public.notifications (recipient_id, archived_at, created_at DESC);
