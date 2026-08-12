
CREATE TABLE IF NOT EXISTS public.project_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  owner_id uuid,
  source text NOT NULL DEFAULT 'delivery',
  source_deal_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_requirements_project_idx ON public.project_requirements(project_id);
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.project_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'external',
  status text NOT NULL DEFAULT 'open',
  depends_on_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  depends_on_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_dependencies_project_idx ON public.project_dependencies(project_id);
ALTER TABLE public.project_dependencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.deal_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  owner_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_requirements_deal_idx ON public.deal_requirements(deal_id);
ALTER TABLE public.deal_requirements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.deal_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'external',
  status text NOT NULL DEFAULT 'open',
  depends_on_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_dependencies_deal_idx ON public.deal_dependencies(deal_id);
ALTER TABLE public.deal_dependencies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_project_requirements_updated BEFORE UPDATE ON public.project_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_project_dependencies_updated BEFORE UPDATE ON public.project_dependencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deal_requirements_updated BEFORE UPDATE ON public.deal_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deal_dependencies_updated BEFORE UPDATE ON public.deal_dependencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "ws members read project_requirements" ON public.project_requirements
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws members write project_requirements" ON public.project_requirements
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id)) WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws members read project_dependencies" ON public.project_dependencies
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws members write project_dependencies" ON public.project_dependencies
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id)) WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws members read deal_requirements" ON public.deal_requirements
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws members write deal_requirements" ON public.deal_requirements
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id)) WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "ws members read deal_dependencies" ON public.deal_dependencies
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws members write deal_dependencies" ON public.deal_dependencies
  FOR ALL USING (public.is_workspace_member(auth.uid(), workspace_id)) WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
