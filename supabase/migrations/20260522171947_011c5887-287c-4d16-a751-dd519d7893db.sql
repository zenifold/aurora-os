
-- Templates
CREATE TABLE public.delivery_deliverable_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  default_model text DEFAULT 'google/gemini-2.5-flash',
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ddt_workspace ON public.delivery_deliverable_templates(workspace_id);
ALTER TABLE public.delivery_deliverable_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage delivery templates" ON public.delivery_deliverable_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_templates.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_templates.workspace_id));
CREATE TRIGGER trg_ddt_updated BEFORE UPDATE ON public.delivery_deliverable_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Deliverables (project-scoped)
CREATE TABLE public.delivery_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','internal_review','client_review','approved','published','archived')),
  template_id uuid REFERENCES public.delivery_deliverable_templates(id) ON DELETE SET NULL,
  current_version_id uuid,
  owner_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dd_project ON public.delivery_deliverables(project_id);
CREATE INDEX idx_dd_workspace ON public.delivery_deliverables(workspace_id);
ALTER TABLE public.delivery_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage delivery deliverables" ON public.delivery_deliverables
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverables.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverables.workspace_id));
CREATE TRIGGER trg_dd_updated BEFORE UPDATE ON public.delivery_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Versions
CREATE TABLE public.delivery_deliverable_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.delivery_deliverables(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  ai_model text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deliverable_id, version)
);
CREATE INDEX idx_ddv_deliverable ON public.delivery_deliverable_versions(deliverable_id);
ALTER TABLE public.delivery_deliverable_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read delivery versions" ON public.delivery_deliverable_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_versions.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_versions.workspace_id));
ALTER TABLE public.delivery_deliverables
  ADD CONSTRAINT delivery_deliverables_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.delivery_deliverable_versions(id) ON DELETE SET NULL;

-- Agent runs
CREATE TABLE public.delivery_deliverable_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.delivery_deliverables(id) ON DELETE CASCADE,
  section_key text,
  model text,
  status text NOT NULL DEFAULT 'success',
  tokens_input integer,
  tokens_output integer,
  instruction text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ddar_deliverable ON public.delivery_deliverable_agent_runs(deliverable_id);
ALTER TABLE public.delivery_deliverable_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read delivery agent runs" ON public.delivery_deliverable_agent_runs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_agent_runs.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_agent_runs.workspace_id));

-- Comments
CREATE TABLE public.delivery_deliverable_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.delivery_deliverables(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.delivery_deliverable_versions(id) ON DELETE SET NULL,
  section_key text,
  parent_id uuid REFERENCES public.delivery_deliverable_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id uuid,
  author_name text,
  author_email text,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ddc_deliverable ON public.delivery_deliverable_comments(deliverable_id);
ALTER TABLE public.delivery_deliverable_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage delivery comments" ON public.delivery_deliverable_comments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_comments.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_comments.workspace_id));
CREATE TRIGGER trg_ddc_updated BEFORE UPDATE ON public.delivery_deliverable_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Share links
CREATE TABLE public.delivery_deliverable_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.delivery_deliverables(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.delivery_deliverable_versions(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  access text NOT NULL DEFAULT 'read' CHECK (access IN ('read','comment')),
  recipient_email text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ddsl_deliverable ON public.delivery_deliverable_share_links(deliverable_id);
CREATE INDEX idx_ddsl_token ON public.delivery_deliverable_share_links(token);
ALTER TABLE public.delivery_deliverable_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage delivery share links" ON public.delivery_deliverable_share_links
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_share_links.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.workspace_id = delivery_deliverable_share_links.workspace_id));

-- Per-project portal branding overrides
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS portal_branding jsonb NOT NULL DEFAULT '{}'::jsonb;
