-- Project Playbooks: reusable project blueprints

CREATE TABLE public.project_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'rocket',
  color TEXT DEFAULT '#8b5cf6',
  kind TEXT NOT NULL DEFAULT 'custom',
  default_duration_days INTEGER NOT NULL DEFAULT 30,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_playbooks_workspace ON public.project_playbooks(workspace_id) WHERE is_archived = false;

CREATE TABLE public.playbook_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.project_playbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  milestone_type TEXT NOT NULL DEFAULT 'delivery',
  day_offset INTEGER NOT NULL DEFAULT 0,
  requires_signoff BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_playbook_milestones_playbook ON public.playbook_milestones(playbook_id);

CREATE TABLE public.playbook_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.project_playbooks(id) ON DELETE CASCADE,
  playbook_milestone_id UUID REFERENCES public.playbook_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  task_type TEXT NOT NULL DEFAULT 'task',
  day_offset_start INTEGER,
  day_offset_due INTEGER,
  assignee_role_hint TEXT,
  is_customer_task BOOLEAN NOT NULL DEFAULT false,
  estimated_hours NUMERIC,
  tags TEXT[] DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_playbook_tasks_playbook ON public.playbook_tasks(playbook_id);

ALTER TABLE public.project_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_tasks ENABLE ROW LEVEL SECURITY;

-- Playbooks: members read, managers/owners write
CREATE POLICY "Members view playbooks"
  ON public.project_playbooks FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Managers manage playbooks"
  ON public.project_playbooks FOR ALL
  USING (
    public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role)
    OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role)
    OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
  );

CREATE POLICY "Members view playbook milestones"
  ON public.playbook_milestones FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Managers manage playbook milestones"
  ON public.playbook_milestones FOR ALL
  USING (
    public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role)
    OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role)
    OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
  );

CREATE POLICY "Members view playbook tasks"
  ON public.playbook_tasks FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Managers manage playbook tasks"
  ON public.playbook_tasks FOR ALL
  USING (
    public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role)
    OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), workspace_id, 'manager'::workspace_role)
    OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
  );

CREATE TRIGGER playbooks_updated_at
  BEFORE UPDATE ON public.project_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
