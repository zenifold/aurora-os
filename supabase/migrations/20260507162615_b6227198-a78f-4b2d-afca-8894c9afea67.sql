
CREATE TABLE IF NOT EXISTS public.user_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid,
  emoji text,
  text text,
  clear_at timestamptz,
  dnd_until timestamptz,
  ooo_until timestamptz,
  ooo_delegate_id uuid,
  ooo_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_status select same workspace" ON public.user_status;
CREATE POLICY "user_status select same workspace"
ON public.user_status FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = public.user_status.workspace_id
  )
);

DROP POLICY IF EXISTS "user_status modify own" ON public.user_status;
CREATE POLICY "user_status modify own"
ON public.user_status FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_status_workspace ON public.user_status(workspace_id);

CREATE OR REPLACE FUNCTION public.user_status_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_status_touch_trg ON public.user_status;
CREATE TRIGGER user_status_touch_trg
BEFORE UPDATE ON public.user_status
FOR EACH ROW EXECUTE FUNCTION public.user_status_touch();

-- Helper: is a user currently DND?
CREATE OR REPLACE FUNCTION public.user_is_dnd(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT dnd_until > now() FROM public.user_status WHERE user_id = _user_id),
    false
  );
$$;
