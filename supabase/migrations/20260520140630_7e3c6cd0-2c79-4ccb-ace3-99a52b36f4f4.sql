-- RAID log: Risks, Assumptions, Issues, Decisions per project
CREATE TYPE public.raid_item_type AS ENUM ('risk', 'assumption', 'issue', 'decision');
CREATE TYPE public.raid_impact AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.raid_likelihood AS ENUM ('unlikely', 'possible', 'likely', 'almost_certain');
CREATE TYPE public.raid_status AS ENUM ('open', 'monitoring', 'mitigated', 'closed', 'accepted', 'rejected');

CREATE TABLE public.project_raid_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_type public.raid_item_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  impact public.raid_impact,
  likelihood public.raid_likelihood,
  status public.raid_status NOT NULL DEFAULT 'open',
  mitigation TEXT,
  due_date DATE,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_client_visible BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_raid_project ON public.project_raid_items(project_id, item_type, status);
CREATE INDEX idx_raid_workspace ON public.project_raid_items(workspace_id);

ALTER TABLE public.project_raid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view RAID items"
  ON public.project_raid_items FOR SELECT
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create RAID items"
  ON public.project_raid_items FOR INSERT
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update RAID items"
  ON public.project_raid_items FOR UPDATE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete RAID items"
  ON public.project_raid_items FOR DELETE
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TRIGGER trg_raid_updated_at
  BEFORE UPDATE ON public.project_raid_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();