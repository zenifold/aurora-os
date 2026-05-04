
-- ============ ENUMS ============
create type public.workspace_role as enum ('owner', 'member');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.field_type as enum ('text','number','date','select','multi_select','user','checkbox','url','email');
create type public.view_type as enum ('table','kanban','canvas','calendar','timeline');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ WORKSPACES ============
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid not null references auth.users(id),
  plan text not null default 'free',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- ============ USER ROLES (separate table per security guidelines) ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique(user_id, workspace_id)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _workspace_id uuid, _role public.workspace_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and workspace_id = _workspace_id and role = _role
  );
$$;

create or replace function public.is_workspace_member(_user_id uuid, _workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and workspace_id = _workspace_id
  );
$$;

-- ============ WORKSPACE MEMBERS ============
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text,
  joined_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

-- Workspace policies
create policy "workspaces_select_members" on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), id));
create policy "workspaces_insert_authenticated" on public.workspaces
  for insert to authenticated
  with check (auth.uid() = owner_id);
create policy "workspaces_update_owner" on public.workspaces
  for update to authenticated
  using (public.has_role(auth.uid(), id, 'owner'));
create policy "workspaces_delete_owner" on public.workspaces
  for delete to authenticated
  using (public.has_role(auth.uid(), id, 'owner'));

-- user_roles policies
create policy "user_roles_select_members" on public.user_roles
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "user_roles_insert_owner_or_self_first" on public.user_roles
  for insert to authenticated
  with check (
    -- workspace owner can grant roles
    public.has_role(auth.uid(), workspace_id, 'owner')
    -- OR the user is creating their own initial owner role for a workspace they just created
    or (auth.uid() = user_id and exists (
      select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()
    ))
  );
create policy "user_roles_update_owner" on public.user_roles
  for update to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));
create policy "user_roles_delete_owner" on public.user_roles
  for delete to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));

-- workspace_members policies
create policy "workspace_members_select" on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "workspace_members_insert" on public.workspace_members
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), workspace_id, 'owner')
    or (auth.uid() = user_id and exists (
      select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()
    ))
  );
create policy "workspace_members_delete_owner" on public.workspace_members
  for delete to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));

-- ============ PROJECTS ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#6366f1',
  icon text not null default 'folder',
  parent_id uuid references public.projects(id) on delete cascade,
  is_archived boolean not null default false,
  position float not null default 0,
  settings jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects_select_members" on public.projects
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "projects_insert_members" on public.projects
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy "projects_update_members" on public.projects
  for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "projects_delete_members" on public.projects
  for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

-- ============ CUSTOM FIELDS ============
create table public.custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  field_type public.field_type not null,
  options jsonb,
  default_value jsonb,
  is_required boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.custom_field_defs enable row level security;

create policy "fields_select_members" on public.custom_field_defs
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "fields_all_members" on public.custom_field_defs
  for all to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id))
  with check (public.is_workspace_member(auth.uid(), workspace_id));

-- ============ TASKS ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description jsonb,
  status text not null default 'todo',
  priority public.task_priority not null default 'medium',
  assignee_ids uuid[] not null default '{}',
  due_date date,
  start_date date,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  custom_values jsonb not null default '{}',
  tags text[] not null default '{}',
  position float not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.tasks enable row level security;

create policy "tasks_select_members" on public.tasks
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "tasks_insert_members" on public.tasks
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy "tasks_update_members" on public.tasks
  for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "tasks_delete_members" on public.tasks
  for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_workspace on public.tasks(workspace_id);
create index idx_tasks_assignees on public.tasks using gin(assignee_ids);

-- ============ VIEWS ============
create table public.views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  view_type public.view_type not null default 'table',
  config jsonb not null default '{}',
  filters jsonb not null default '[]',
  sorts jsonb not null default '[]',
  group_by text,
  is_default boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.views enable row level security;

create policy "views_select_members" on public.views
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "views_all_members" on public.views
  for all to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id))
  with check (public.is_workspace_member(auth.uid(), workspace_id));

-- ============ COMMENTS ============
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content jsonb not null,
  parent_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "comments_select_members" on public.comments
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "comments_insert_members" on public.comments
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id) and auth.uid() = author_id);
create policy "comments_update_author" on public.comments
  for update to authenticated using (auth.uid() = author_id);
create policy "comments_delete_author" on public.comments
  for delete to authenticated using (auth.uid() = author_id);

-- ============ ACTIVITY LOG ============
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "activity_select_members" on public.activity_log
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "activity_insert_members" on public.activity_log
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

-- ============ updated_at triggers ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_workspaces_updated before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_comments_updated before update on public.comments
  for each row execute function public.set_updated_at();
