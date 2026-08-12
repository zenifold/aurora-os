
-- Billing model enum
DO $$ BEGIN
  CREATE TYPE public.billing_model AS ENUM ('time_and_materials','fixed_fee','milestone','retainer','non_billable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rate cards
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  currency text NOT NULL DEFAULT 'USD',
  is_default boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_cards_ws_idx ON public.rate_cards(workspace_id);

ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_select_members" ON public.rate_cards FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rc_insert_members" ON public.rate_cards FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rc_update_members" ON public.rate_cards FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rc_delete_members" ON public.rate_cards FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER rate_cards_set_updated_at BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rate card entries (role-based or person-based)
CREATE TABLE IF NOT EXISTS public.rate_card_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id uuid NOT NULL REFERENCES public.rate_cards(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role_name text,
  user_id uuid,
  bill_rate numeric NOT NULL DEFAULT 0,
  cost_rate numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role_name IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS rce_card_idx ON public.rate_card_entries(rate_card_id);
CREATE INDEX IF NOT EXISTS rce_ws_idx ON public.rate_card_entries(workspace_id);

ALTER TABLE public.rate_card_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rce_select_members" ON public.rate_card_entries FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rce_insert_members" ON public.rate_card_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rce_update_members" ON public.rate_card_entries FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "rce_delete_members" ON public.rate_card_entries FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER rate_card_entries_set_updated_at BEFORE UPDATE ON public.rate_card_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend projects with billing_model + rate_card link
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS billing_model public.billing_model NOT NULL DEFAULT 'time_and_materials',
  ADD COLUMN IF NOT EXISTS rate_card_id uuid REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retainer_amount numeric,
  ADD COLUMN IF NOT EXISTS retainer_period text;

-- Extend project_financials with budget + alert thresholds
ALTER TABLE public.project_financials
  ADD COLUMN IF NOT EXISTS budget_amount numeric,
  ADD COLUMN IF NOT EXISTS budget_hours numeric,
  ADD COLUMN IF NOT EXISTS budget_alert_thresholds integer[] NOT NULL DEFAULT ARRAY[50,75,90,100],
  ADD COLUMN IF NOT EXISTS last_alerted_threshold integer;
