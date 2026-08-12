
-- template_phases
CREATE TABLE public.template_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  color text,
  icon text,
  owner_role text,
  target_days integer,
  is_terminal boolean NOT NULL DEFAULT false,
  entry_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, key)
);
CREATE INDEX idx_template_phases_template ON public.template_phases(template_id, order_index);
ALTER TABLE public.template_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members rw template_phases" ON public.template_phases
  USING (EXISTS (SELECT 1 FROM public.project_templates t WHERE t.id = template_phases.template_id AND public.is_workspace_member(auth.uid(), t.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_templates t WHERE t.id = template_phases.template_id AND public.is_workspace_member(auth.uid(), t.workspace_id)));

-- engagement_phases
CREATE TABLE public.engagement_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_phase_id uuid REFERENCES public.template_phases(id) ON DELETE SET NULL,
  key text NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  color text,
  icon text,
  owner_role text,
  target_days integer,
  is_terminal boolean NOT NULL DEFAULT false,
  exit_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);
CREATE INDEX idx_engagement_phases_project ON public.engagement_phases(project_id, order_index);
ALTER TABLE public.engagement_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members rw engagement_phases" ON public.engagement_phases
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- projects.current_phase_id
ALTER TABLE public.projects
  ADD COLUMN current_phase_id uuid REFERENCES public.engagement_phases(id) ON DELETE SET NULL;

-- project_template_items.phase_key
ALTER TABLE public.project_template_items
  ADD COLUMN phase_key text;
