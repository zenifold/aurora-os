
-- 1. Extend ai_agents
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS autonomy_level text NOT NULL DEFAULT 'suggest',
  ADD COLUMN IF NOT EXISTS guardrails jsonb NOT NULL DEFAULT '{
    "max_task_spend": 0,
    "can_modify": ["tasks_assigned_to_me","documents_i_created"],
    "can_notify": ["assignee","project_lead"],
    "cannot_delete": true,
    "requires_approval_for": ["external_email","invoice","hire","budget_over_100"]
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS current_task_id uuid,
  ADD COLUMN IF NOT EXISTS model_config jsonb NOT NULL DEFAULT '{"provider":"lovable","model":"google/gemini-3-flash-preview","temperature":0.3}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_autonomy_check
    CHECK (autonomy_level IN ('suggest','bounded','autonomous'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_status_check
    CHECK (status IN ('idle','working','blocked','error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_workspace_handle_key
  ON public.ai_agents (workspace_id, handle) WHERE handle IS NOT NULL;

-- 2. agent_tools registry (workspace-scoped)
CREATE TABLE IF NOT EXISTS public.agent_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_type text NOT NULL CHECK (tool_type IN ('internal_api','external_api','browser','code_execution','human_handoff')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_tools_select_members" ON public.agent_tools
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_tools_insert_owner" ON public.agent_tools
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
CREATE POLICY "agent_tools_update_owner" ON public.agent_tools
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
CREATE POLICY "agent_tools_delete_owner" ON public.agent_tools
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

CREATE TRIGGER agent_tools_set_updated_at BEFORE UPDATE ON public.agent_tools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. agent_executions (separate from existing agent_runs which is content-gen)
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  parent_execution_id uuid REFERENCES public.agent_executions(id) ON DELETE SET NULL,
  trigger text NOT NULL CHECK (trigger IN ('user_request','task_assigned','scheduled','event_driven','proactive')),
  goal text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  tokens_used int NOT NULL DEFAULT 0,
  cost numeric(10,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','running','completed','failed','blocked','awaiting_approval')),
  result jsonb,
  error_message text,
  reviewed_by uuid,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected','modified','not_required')),
  requested_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS agent_executions_ws_status_idx ON public.agent_executions(workspace_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_executions_agent_idx ON public.agent_executions(agent_id, started_at DESC);

ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_executions_select_members" ON public.agent_executions
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_executions_insert_members" ON public.agent_executions
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_executions_update_members" ON public.agent_executions
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 4. agent_action_approvals queue
CREATE TABLE IF NOT EXISTS public.agent_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  execution_id uuid REFERENCES public.agent_executions(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  action_summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','executed')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_approvals_ws_status_idx ON public.agent_action_approvals(workspace_id, status, created_at DESC);

ALTER TABLE public.agent_action_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_approvals_select_members" ON public.agent_action_approvals
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_approvals_insert_members" ON public.agent_action_approvals
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_approvals_update_members" ON public.agent_action_approvals
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- 5. agent_memories
CREATE TABLE IF NOT EXISTS public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('preference','outcome','relationship','pattern','feedback')),
  content text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(3,2) NOT NULL DEFAULT 0.8,
  last_accessed timestamptz NOT NULL DEFAULT now(),
  access_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_memories_agent_idx ON public.agent_memories(agent_id, last_accessed DESC);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_memories_select_members" ON public.agent_memories
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_memories_insert_members" ON public.agent_memories
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_memories_update_members" ON public.agent_memories
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "agent_memories_delete_owner" ON public.agent_memories
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
