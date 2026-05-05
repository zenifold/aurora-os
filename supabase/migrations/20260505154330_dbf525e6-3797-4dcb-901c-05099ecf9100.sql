
-- Workspace kind + delivery link
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'delivery' CHECK (kind IN ('sales','delivery','hybrid')),
  ADD COLUMN IF NOT EXISTS linked_delivery_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  title text,
  avatar_url text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_select_members ON public.contacts FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY contacts_insert_members ON public.contacts FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY contacts_update_members ON public.contacts FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY contacts_delete_members ON public.contacts FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Deal stages (per workspace, ordered)
CREATE TABLE IF NOT EXISTS public.deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  order_index int NOT NULL DEFAULT 0,
  stage_type text NOT NULL DEFAULT 'open' CHECK (stage_type IN ('open','won','lost')),
  default_probability int NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_stages_select_members ON public.deal_stages FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deal_stages_insert_members ON public.deal_stages FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deal_stages_update_members ON public.deal_stages FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deal_stages_delete_members ON public.deal_stages FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

-- Deals
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.deal_stages(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  owner_id uuid,
  title text NOT NULL,
  description text,
  value numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  probability int NOT NULL DEFAULT 25,
  expected_close_date date,
  source text,
  tags text[] NOT NULL DEFAULT '{}',
  position double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost')),
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  -- Set when handoff to delivery happens
  handed_off_project_id uuid,
  handed_off_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_select_members ON public.deals FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deals_insert_members ON public.deals FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deals_update_members ON public.deals FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deals_delete_members ON public.deals FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS deals_workspace_stage_idx ON public.deals(workspace_id, stage_id);

-- Deal activities timeline
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  author_id uuid,
  activity_type text NOT NULL DEFAULT 'note' CHECK (activity_type IN ('note','call','email','meeting','stage_change','system')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_activities_select_members ON public.deal_activities FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deal_activities_insert_members ON public.deal_activities FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY deal_activities_delete_author ON public.deal_activities FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE INDEX IF NOT EXISTS deal_activities_deal_idx ON public.deal_activities(deal_id, created_at DESC);

-- Seed default deal stages helper
CREATE OR REPLACE FUNCTION public.seed_default_deal_stages(_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.deal_stages WHERE workspace_id = _workspace_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.deal_stages (workspace_id, name, color, order_index, stage_type, default_probability) VALUES
    (_workspace_id, 'Lead',         '#94a3b8', 0, 'open', 10),
    (_workspace_id, 'Qualified',    '#3b82f6', 1, 'open', 25),
    (_workspace_id, 'Proposal',     '#a855f7', 2, 'open', 50),
    (_workspace_id, 'Negotiation',  '#f59e0b', 3, 'open', 75),
    (_workspace_id, 'Won',          '#10b981', 4, 'won', 100),
    (_workspace_id, 'Lost',         '#ef4444', 5, 'lost', 0);
END;
$$;
