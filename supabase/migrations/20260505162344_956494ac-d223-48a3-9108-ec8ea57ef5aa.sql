CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TABLE public.change_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  cost_impact NUMERIC NOT NULL DEFAULT 0,
  timeline_impact_days INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  requested_by UUID,
  internal_approved_by UUID,
  internal_approved_at TIMESTAMP WITH TIME ZONE,
  client_approved_by TEXT,
  client_approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_orders_project ON public.change_orders(project_id);
CREATE INDEX idx_change_orders_workspace ON public.change_orders(workspace_id);

ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "change_orders_select_members" ON public.change_orders
FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "change_orders_insert_members" ON public.change_orders
FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "change_orders_update_members" ON public.change_orders
FOR UPDATE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "change_orders_delete_members" ON public.change_orders
FOR DELETE TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER update_change_orders_updated_at
BEFORE UPDATE ON public.change_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();