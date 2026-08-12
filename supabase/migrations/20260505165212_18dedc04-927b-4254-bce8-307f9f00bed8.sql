-- ===== client_portal_access =====
create table public.client_portal_access (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  email text not null,
  name text not null,
  company text,
  avatar_url text,
  role text not null default 'contributor' check (role in ('viewer','contributor','stakeholder')),
  access_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  token_expires_at timestamptz,
  visible_task_types text[] not null default array['task'],
  can_see_financials boolean not null default false,
  can_see_team_names boolean not null default true,
  can_see_timeline boolean not null default true,
  custom_brand_color text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  invited_by uuid,
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, email)
);

create index idx_cpa_token on public.client_portal_access(access_token);
create index idx_cpa_project on public.client_portal_access(project_id);

alter table public.client_portal_access enable row level security;

create policy cpa_select_members on public.client_portal_access
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy cpa_insert_members on public.client_portal_access
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy cpa_update_members on public.client_portal_access
  for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy cpa_delete_members on public.client_portal_access
  for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create trigger cpa_updated_at
  before update on public.client_portal_access
  for each row execute function public.set_updated_at();

-- ===== client_deliverables =====
create table public.client_deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  task_id uuid not null unique,
  client_portal_access_id uuid references public.client_portal_access(id) on delete set null,
  deliverable_type text not null check (deliverable_type in (
    'approval','review','feedback','content_upload','data_provision','signature','payment','decision'
  )),
  client_instructions text,
  client_deadline date,
  impact_description text,
  downstream_task_ids uuid[] not null default '{}',
  submitted_at timestamptz,
  submitted_by uuid references public.client_portal_access(id) on delete set null,
  submitted_content jsonb,
  review_status text not null default 'pending' check (review_status in (
    'pending','submitted','needs_revision','approved','rejected'
  )),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  revision_count int not null default 0,
  max_revisions int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cd_project on public.client_deliverables(project_id);
create index idx_cd_cpa on public.client_deliverables(client_portal_access_id);

alter table public.client_deliverables enable row level security;

create policy cd_select_members on public.client_deliverables
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy cd_insert_members on public.client_deliverables
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy cd_update_members on public.client_deliverables
  for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy cd_delete_members on public.client_deliverables
  for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create trigger cd_updated_at
  before update on public.client_deliverables
  for each row execute function public.set_updated_at();

-- ===== portal_activity_log =====
create table public.portal_activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  client_portal_access_id uuid references public.client_portal_access(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'login','viewed_task','completed_deliverable','commented',
    'downloaded_file','viewed_timeline','acknowledged_impact'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_pal_project on public.portal_activity_log(project_id);
create index idx_pal_cpa on public.portal_activity_log(client_portal_access_id);

alter table public.portal_activity_log enable row level security;

create policy pal_select_members on public.portal_activity_log
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy pal_insert_members on public.portal_activity_log
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));