CREATE TABLE public.project_financials (
  project_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  contract_value numeric,
  currency text NOT NULL DEFAULT 'USD',
  default_bill_rate numeric,
  default_cost_rate numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY pf_select_members ON public.project_financials FOR SELECT TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY pf_insert_members ON public.project_financials FOR INSERT TO authenticated
WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY pf_update_members ON public.project_financials FOR UPDATE TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY pf_delete_members ON public.project_financials FOR DELETE TO authenticated
USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER project_financials_set_updated_at
BEFORE UPDATE ON public.project_financials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();