DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.workspace_role'::regtype AND enumlabel = 'manager'
  ) THEN
    ALTER TYPE public.workspace_role ADD VALUE 'manager';
  END IF;
END $$;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS hidden_nav_items text[] NOT NULL DEFAULT ARRAY[]::text[];