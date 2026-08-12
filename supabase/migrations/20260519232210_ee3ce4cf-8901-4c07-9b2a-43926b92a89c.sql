CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  task_id UUID,
  submitted_by UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  incurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','invoiced')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  invoice_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_project ON public.expenses(project_id);
CREATE INDEX idx_expenses_workspace ON public.expenses(workspace_id);
CREATE INDEX idx_expenses_status ON public.expenses(status);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view expenses" ON public.expenses FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = expenses.workspace_id));
CREATE POLICY "Members create expenses" ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = submitted_by AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = expenses.workspace_id));
CREATE POLICY "Submitter or owner update expense" ON public.expenses FOR UPDATE
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(), expenses.workspace_id, 'owner'::workspace_role));
CREATE POLICY "Submitter or owner delete expense" ON public.expenses FOR DELETE
  USING (auth.uid() = submitted_by OR public.has_role(auth.uid(), expenses.workspace_id, 'owner'::workspace_role));

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void','overdue')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  client_name TEXT,
  client_email TEXT,
  client_address TEXT,
  share_token TEXT UNIQUE,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, invoice_number)
);
CREATE INDEX idx_invoices_project ON public.invoices(project_id);
CREATE INDEX idx_invoices_workspace_status ON public.invoices(workspace_id, status);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view invoices" ON public.invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = invoices.workspace_id));
CREATE POLICY "Members create invoices" ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = invoices.workspace_id));
CREATE POLICY "Creator or owner update invoice" ON public.invoices FOR UPDATE
  USING ((auth.uid() = created_by AND status = 'draft') OR public.has_role(auth.uid(), invoices.workspace_id, 'owner'::workspace_role));
CREATE POLICY "Creator or owner delete draft invoice" ON public.invoices FOR DELETE
  USING ((auth.uid() = created_by AND status = 'draft') OR public.has_role(auth.uid(), invoices.workspace_id, 'owner'::workspace_role));

CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','time','milestone','expense')),
  source_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_line_items_invoice ON public.invoice_line_items(invoice_id);
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View line items via invoice" ON public.invoice_line_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i JOIN public.user_roles ur ON ur.workspace_id = i.workspace_id
                 WHERE i.id = invoice_line_items.invoice_id AND ur.user_id = auth.uid()));
CREATE POLICY "Insert line items on draft invoice" ON public.invoice_line_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id
                      AND i.status = 'draft'
                      AND (i.created_by = auth.uid() OR public.has_role(auth.uid(), i.workspace_id, 'owner'::workspace_role))));
CREATE POLICY "Update line items on draft invoice" ON public.invoice_line_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id
                 AND i.status = 'draft'
                 AND (i.created_by = auth.uid() OR public.has_role(auth.uid(), i.workspace_id, 'owner'::workspace_role))));
CREATE POLICY "Delete line items on draft invoice" ON public.invoice_line_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id
                 AND i.status = 'draft'
                 AND (i.created_by = auth.uid() OR public.has_role(auth.uid(), i.workspace_id, 'owner'::workspace_role))));

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();