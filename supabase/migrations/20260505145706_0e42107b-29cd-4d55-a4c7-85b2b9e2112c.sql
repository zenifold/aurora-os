-- Team members: role/capacity/rates per workspace user
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null default 'contributor',
  seniority text,
  weekly_capacity_hours numeric not null default 40,
  hourly_cost numeric,
  hourly_bill_rate numeric,
  skills text[] not null default '{}',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.team_members enable row level security;

create policy team_members_select_members on public.team_members
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy team_members_insert_members on public.team_members
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id));
create policy team_members_update_members on public.team_members
  for update to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy team_members_delete_members on public.team_members
  for delete to authenticated using (is_workspace_member(auth.uid(), workspace_id));

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

create index team_members_workspace_idx on public.team_members(workspace_id);
create index team_members_user_idx on public.team_members(user_id);

-- Time logs: hours logged against tasks
create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,
  sprint_id uuid,
  hours numeric not null check (hours > 0),
  log_date date not null default current_date,
  description text,
  is_billable boolean not null default true,
  hourly_rate_snapshot numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.time_logs enable row level security;

create policy time_logs_select_members on public.time_logs
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy time_logs_insert_members on public.time_logs
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id) and auth.uid() = user_id);
create policy time_logs_update_owner on public.time_logs
  for update to authenticated using (auth.uid() = user_id);
create policy time_logs_delete_owner on public.time_logs
  for delete to authenticated using (auth.uid() = user_id);

create trigger time_logs_set_updated_at
  before update on public.time_logs
  for each row execute function public.set_updated_at();

create index time_logs_workspace_idx on public.time_logs(workspace_id);
create index time_logs_task_idx on public.time_logs(task_id);
create index time_logs_user_date_idx on public.time_logs(user_id, log_date);
create index time_logs_sprint_idx on public.time_logs(sprint_id);
