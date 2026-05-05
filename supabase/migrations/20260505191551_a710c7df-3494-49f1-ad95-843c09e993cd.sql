
create table public.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  tier int not null check (tier between 1 and 5),
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  cooldown_hours int not null default 24,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.escalation_rules enable row level security;

create policy "esc_rules_select_members" on public.escalation_rules for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "esc_rules_insert_owner" on public.escalation_rules for insert to authenticated
  with check (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy "esc_rules_update_owner" on public.escalation_rules for update to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy "esc_rules_delete_owner" on public.escalation_rules for delete to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

create trigger esc_rules_touch before update on public.escalation_rules
  for each row execute function public.touch_updated_at();

create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  rule_id uuid,
  project_id uuid not null,
  tier int not null check (tier between 1 and 5),
  title text not null,
  detail text,
  triggered_by jsonb not null default '{}'::jsonb,
  impact jsonb not null default '{}'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','acknowledged','resolved','escalated_further')),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.escalations enable row level security;

create policy "escalations_select_members" on public.escalations for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "escalations_insert_members" on public.escalations for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy "escalations_update_members" on public.escalations for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "escalations_delete_members" on public.escalations for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create index idx_escalations_workspace on public.escalations(workspace_id);
create index idx_escalations_project on public.escalations(project_id);
create index idx_escalations_status on public.escalations(status);

create trigger escalations_touch before update on public.escalations
  for each row execute function public.touch_updated_at();
