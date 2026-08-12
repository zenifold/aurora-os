
create table public.workspace_overview_templates (
  workspace_id uuid primary key,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workspace_overview_templates enable row level security;

create policy "wot_select_members" on public.workspace_overview_templates
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "wot_insert_owner" on public.workspace_overview_templates
  for insert to authenticated with check (has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy "wot_update_owner" on public.workspace_overview_templates
  for update to authenticated using (has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy "wot_delete_owner" on public.workspace_overview_templates
  for delete to authenticated using (has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

create table public.project_overviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null unique,
  refresh_cadence text not null default 'daily',
  sections_override jsonb,
  last_refreshed_at timestamptz,
  next_refresh_at timestamptz,
  refresh_status text not null default 'idle',
  refresh_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_overviews enable row level security;

create policy "po_select_members" on public.project_overviews
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "po_insert_members" on public.project_overviews
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id));
create policy "po_update_members" on public.project_overviews
  for update to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "po_delete_members" on public.project_overviews
  for delete to authenticated using (is_workspace_member(auth.uid(), workspace_id));

create index idx_project_overviews_next_refresh on public.project_overviews (next_refresh_at)
  where refresh_cadence <> 'off';

create table public.project_overview_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  overview_id uuid not null,
  sections jsonb not null default '[]'::jsonb,
  summary text,
  health text,
  ai_model text,
  generated_by uuid,
  generated_at timestamptz not null default now()
);
alter table public.project_overview_snapshots enable row level security;

create policy "pos_select_members" on public.project_overview_snapshots
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "pos_insert_members" on public.project_overview_snapshots
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id));
create policy "pos_delete_members" on public.project_overview_snapshots
  for delete to authenticated using (is_workspace_member(auth.uid(), workspace_id));

create index idx_pos_project_generated on public.project_overview_snapshots (project_id, generated_at desc);

create trigger trg_wot_touch before update on public.workspace_overview_templates
  for each row execute function public.set_updated_at();
create trigger trg_po_touch before update on public.project_overviews
  for each row execute function public.set_updated_at();
