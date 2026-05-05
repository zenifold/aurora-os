
-- Sprints
create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  name text not null,
  goal text,
  status text not null default 'planning' check (status in ('planning','active','completed','cancelled')),
  start_date date not null,
  end_date date not null,
  capacity_hours numeric(10,2),
  planned_hours numeric(10,2) not null default 0,
  logged_hours numeric(10,2) not null default 0,
  capacity_points integer,
  planned_points integer not null default 0,
  completed_points integer not null default 0,
  budget_allocated numeric(12,2),
  budget_spent numeric(12,2) not null default 0,
  health_score integer check (health_score between 0 and 100),
  risk_flags text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sprints_project_idx on public.sprints(project_id);
create index sprints_workspace_idx on public.sprints(workspace_id);

alter table public.sprints enable row level security;

create policy sprints_select_members on public.sprints for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprints_insert_members on public.sprints for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprints_update_members on public.sprints for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprints_delete_members on public.sprints for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create trigger sprints_set_updated_at before update on public.sprints
  for each row execute function public.set_updated_at();

-- Sprint tasks (M2M)
create table public.sprint_tasks (
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null,
  added_at timestamptz not null default now(),
  added_by uuid,
  is_committed boolean not null default true,
  original_estimate numeric(10,2),
  primary key (sprint_id, task_id)
);

create index sprint_tasks_task_idx on public.sprint_tasks(task_id);

alter table public.sprint_tasks enable row level security;

create policy sprint_tasks_select_members on public.sprint_tasks for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprint_tasks_insert_members on public.sprint_tasks for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprint_tasks_update_members on public.sprint_tasks for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprint_tasks_delete_members on public.sprint_tasks for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

-- Burndown daily snapshots
create table public.sprint_burndown (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  workspace_id uuid not null,
  snapshot_date date not null,
  remaining_hours numeric(10,2),
  remaining_points integer,
  completed_tasks integer,
  total_tasks integer,
  ideal_remaining numeric(10,2),
  created_at timestamptz not null default now(),
  unique (sprint_id, snapshot_date)
);

create index sprint_burndown_sprint_idx on public.sprint_burndown(sprint_id);

alter table public.sprint_burndown enable row level security;

create policy sprint_burndown_select_members on public.sprint_burndown for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprint_burndown_insert_members on public.sprint_burndown for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprint_burndown_update_members on public.sprint_burndown for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy sprint_burndown_delete_members on public.sprint_burndown for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
