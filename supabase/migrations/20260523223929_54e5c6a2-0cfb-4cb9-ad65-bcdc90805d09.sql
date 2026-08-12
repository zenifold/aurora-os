
-- 1. deal_phases
CREATE TABLE public.deal_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_weeks numeric(6,2),
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_phases_deal_idx ON public.deal_phases(deal_id, position);
ALTER TABLE public.deal_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_phases_select" ON public.deal_phases FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_phases_insert" ON public.deal_phases FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_phases_update" ON public.deal_phases FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_phases_delete" ON public.deal_phases FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER deal_phases_set_updated_at BEFORE UPDATE ON public.deal_phases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. deal_milestones
CREATE TABLE public.deal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_date date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','at_risk','done','missed')),
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_milestones_deal_idx ON public.deal_milestones(deal_id, target_date);
ALTER TABLE public.deal_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_milestones_select" ON public.deal_milestones FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_milestones_insert" ON public.deal_milestones FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_milestones_update" ON public.deal_milestones FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_milestones_delete" ON public.deal_milestones FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER deal_milestones_set_updated_at BEFORE UPDATE ON public.deal_milestones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. deal_assumptions
CREATE TABLE public.deal_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_assumptions_deal_idx ON public.deal_assumptions(deal_id, created_at DESC);
ALTER TABLE public.deal_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_assumptions_select" ON public.deal_assumptions FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_assumptions_insert" ON public.deal_assumptions FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_assumptions_update" ON public.deal_assumptions FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_assumptions_delete" ON public.deal_assumptions FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

-- 4. deal_resources
CREATE TABLE public.deal_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  role text NOT NULL,
  assignee_user_id uuid,
  is_external boolean NOT NULL DEFAULT false,
  vendor_name text,
  hours numeric(8,2),
  hourly_rate numeric(10,2),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_resources_deal_idx ON public.deal_resources(deal_id);
ALTER TABLE public.deal_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_resources_select" ON public.deal_resources FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_resources_insert" ON public.deal_resources FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_resources_update" ON public.deal_resources FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_resources_delete" ON public.deal_resources FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER deal_resources_set_updated_at BEFORE UPDATE ON public.deal_resources FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. deal_quote_options
CREATE TABLE public.deal_quote_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  label text NOT NULL,
  pricing_model text NOT NULL DEFAULT 'fixed' CHECK (pricing_model IN ('fixed','tm','retainer','hybrid')),
  total_value numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  terms text,
  win_probability integer,
  is_selected boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_quote_options_deal_idx ON public.deal_quote_options(deal_id);
ALTER TABLE public.deal_quote_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_quote_options_select" ON public.deal_quote_options FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_quote_options_insert" ON public.deal_quote_options FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_quote_options_update" ON public.deal_quote_options FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "deal_quote_options_delete" ON public.deal_quote_options FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE TRIGGER deal_quote_options_set_updated_at BEFORE UPDATE ON public.deal_quote_options FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Add role to deal_contacts
ALTER TABLE public.deal_contacts ADD COLUMN IF NOT EXISTS stakeholder_role text;

-- 7. Storage bucket for deal documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-documents', 'deal-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "deal_docs_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deal-documents' AND EXISTS (
  SELECT 1 FROM public.deals d
  WHERE d.id::text = (storage.foldername(name))[1]
    AND is_workspace_member(auth.uid(), d.workspace_id)
));
CREATE POLICY "deal_docs_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deal-documents' AND EXISTS (
  SELECT 1 FROM public.deals d
  WHERE d.id::text = (storage.foldername(name))[1]
    AND is_workspace_member(auth.uid(), d.workspace_id)
));
CREATE POLICY "deal_docs_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'deal-documents' AND EXISTS (
  SELECT 1 FROM public.deals d
  WHERE d.id::text = (storage.foldername(name))[1]
    AND is_workspace_member(auth.uid(), d.workspace_id)
));
CREATE POLICY "deal_docs_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'deal-documents' AND EXISTS (
  SELECT 1 FROM public.deals d
  WHERE d.id::text = (storage.foldername(name))[1]
    AND is_workspace_member(auth.uid(), d.workspace_id)
));
