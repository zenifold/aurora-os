create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  name text not null,
  description text,
  milestone_type text not null default 'delivery',
  status text not null default 'upcoming',
  target_date date not null,
  actual_date date,
  payment_amount numeric,
  payment_currency text default 'USD',
  is_paid boolean not null default false,
  completion_criteria text,
  depends_on_ids uuid[] not null default '{}',
  order_index integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create policy milestones_select_members on public.milestones
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy milestones_insert_members on public.milestones
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id));
create policy milestones_update_members on public.milestones
  for update to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy milestones_delete_members on public.milestones
  for delete to authenticated using (is_workspace_member(auth.uid(), workspace_id));

create trigger milestones_set_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

create index milestones_project_idx on public.milestones(project_id);
create index milestones_workspace_idx on public.milestones(workspace_id);
create index milestones_target_date_idx on public.milestones(target_date);