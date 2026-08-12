
-- Sprints
CREATE TABLE public.deal_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planned',
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view deal_sprints" ON public.deal_sprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert deal_sprints" ON public.deal_sprints FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update deal_sprints" ON public.deal_sprints FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete deal_sprints" ON public.deal_sprints FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_deal_sprints_updated_at
BEFORE UPDATE ON public.deal_sprints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_deal_sprints_deal ON public.deal_sprints(deal_id);

-- Tasks
CREATE TABLE public.deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.deal_phases(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES public.deal_milestones(id) ON DELETE SET NULL,
  sprint_id uuid REFERENCES public.deal_sprints(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  estimate_hours numeric,
  assignee_user_id uuid,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view deal_tasks" ON public.deal_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert deal_tasks" ON public.deal_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update deal_tasks" ON public.deal_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete deal_tasks" ON public.deal_tasks FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_deal_tasks_updated_at
BEFORE UPDATE ON public.deal_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_deal_tasks_deal ON public.deal_tasks(deal_id);
CREATE INDEX idx_deal_tasks_phase ON public.deal_tasks(phase_id);
CREATE INDEX idx_deal_tasks_sprint ON public.deal_tasks(sprint_id);
CREATE INDEX idx_deal_tasks_status ON public.deal_tasks(deal_id, status);
