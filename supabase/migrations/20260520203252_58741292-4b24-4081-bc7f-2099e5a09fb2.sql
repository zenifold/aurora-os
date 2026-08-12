-- =============== CONTRACTS ===============
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'sow'
    CHECK (contract_type IN ('sow','msa','order_form','retainer','amendment','other')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','signed','active','expired','terminated')),
  value NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  signed_date DATE,
  effective_start DATE,
  effective_end DATE,
  file_url TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_workspace ON public.contracts(workspace_id);
CREATE INDEX idx_contracts_account ON public.contracts(client_account_id);
CREATE INDEX idx_contracts_deal ON public.contracts(deal_id);
CREATE INDEX idx_contracts_project ON public.contracts(project_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can insert contracts"
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update contracts"
  ON public.contracts FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can delete contracts"
  ON public.contracts FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER contracts_set_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== CUSTOMER DEFAULT TEMPLATE ===============
ALTER TABLE public.client_accounts
  ADD COLUMN default_template_id UUID REFERENCES public.project_templates(id) ON DELETE SET NULL;

-- =============== WON-DEAL AUTOMATION FLAG ===============
ALTER TABLE public.deal_stages
  ADD COLUMN auto_create_engagement BOOLEAN NOT NULL DEFAULT true;