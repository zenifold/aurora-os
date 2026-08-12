
-- Enable RLS on realtime.messages and restrict broadcast/presence subscriptions
-- to authenticated users whose identity or workspace membership matches the topic.
--
-- realtime.messages is owned by supabase_admin. On Supabase Cloud the migration
-- role owns it, so the statements below apply. In the local Docker stack the
-- migration role does not own it and Postgres raises insufficient_privilege
-- (42501), which used to abort `supabase start` on this migration. The
-- ownership-dependent statements are therefore wrapped so they skip with a
-- notice instead of failing the whole run. Local realtime is unauthenticated
-- either way; this only relaxes a guard that the local stack cannot install.

-- Helper: does the authed user belong to the workspace referenced by topic?
-- Lives in public, so it is created regardless of realtime ownership.
CREATE OR REPLACE FUNCTION public.realtime_topic_authorized(_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      -- topic embeds the calling user's id
      _topic LIKE '%' || auth.uid()::text || '%'
      OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND _topic LIKE '%' || wm.workspace_id::text || '%'
      )
    )
$fn$;

DO $do$
BEGIN
  ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Authenticated users can read authorized topics"
    ON realtime.messages;
  CREATE POLICY "Authenticated users can read authorized topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.realtime_topic_authorized(realtime.topic()));

  DROP POLICY IF EXISTS "Authenticated users can broadcast on authorized topics"
    ON realtime.messages;
  CREATE POLICY "Authenticated users can broadcast on authorized topics"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.realtime_topic_authorized(realtime.topic()));
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE
      'Skipping RLS and policies on realtime.messages: current role does not own it (expected in the local Docker stack).';
END
$do$;
