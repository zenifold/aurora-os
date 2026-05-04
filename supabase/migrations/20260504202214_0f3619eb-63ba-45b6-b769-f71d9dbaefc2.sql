-- AI Agents
create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  avatar_emoji text default '🤖',
  description text,
  system_prompt text not null default 'You are a helpful AI assistant working on tasks.',
  model text not null default 'openai/gpt-4o-mini',
  temperature numeric not null default 0.7,
  max_tokens integer not null default 2000,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_agents enable row level security;

create policy "ai_agents_select_members" on public.ai_agents
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "ai_agents_insert_owner" on public.ai_agents
  for insert to authenticated
  with check (public.has_role(auth.uid(), workspace_id, 'owner'));

create policy "ai_agents_update_owner" on public.ai_agents
  for update to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));

create policy "ai_agents_delete_owner" on public.ai_agents
  for delete to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));

create trigger ai_agents_set_updated_at
  before update on public.ai_agents
  for each row execute function public.set_updated_at();

create index idx_ai_agents_workspace on public.ai_agents(workspace_id);

-- AI Task Assignments
create table public.ai_task_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','review_needed','completed','failed','cancelled')),
  instructions text,
  output text,
  error_message text,
  tokens_used integer,
  model_used text,
  iterations integer not null default 0,
  created_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_task_assignments enable row level security;

create policy "ai_task_assignments_select_members" on public.ai_task_assignments
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "ai_task_assignments_insert_members" on public.ai_task_assignments
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy "ai_task_assignments_update_members" on public.ai_task_assignments
  for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "ai_task_assignments_delete_members" on public.ai_task_assignments
  for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create trigger ai_task_assignments_set_updated_at
  before update on public.ai_task_assignments
  for each row execute function public.set_updated_at();

create index idx_ai_task_assignments_task on public.ai_task_assignments(task_id);
create index idx_ai_task_assignments_workspace on public.ai_task_assignments(workspace_id);

-- Realtime for live status updates
alter publication supabase_realtime add table public.ai_task_assignments;