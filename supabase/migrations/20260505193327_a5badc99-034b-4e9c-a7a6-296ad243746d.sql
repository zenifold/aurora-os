-- =========================================================
-- Folder-first architecture: Divisions + Folders
-- =========================================================

-- DIVISIONS: top-level configurable folders per workspace
create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  icon text not null default 'folder',
  color text not null default '#6366f1',
  division_type text not null default 'custom' check (division_type in ('delivery','operations','sales','custom')),
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index divisions_workspace_idx on public.divisions(workspace_id, sort_order);

alter table public.divisions enable row level security;

create policy divisions_select_members on public.divisions
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy divisions_insert_members on public.divisions
  for insert to authenticated with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy divisions_update_members on public.divisions
  for update to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy divisions_delete_owner on public.divisions
  for delete to authenticated using (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

create trigger divisions_set_updated_at before update on public.divisions
  for each row execute function public.set_updated_at();

-- FOLDERS: nested tree within a division
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  division_id uuid not null references public.divisions(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  folder_type text not null default 'generic' check (folder_type in ('client','portfolio','project','phase','generic')),
  client_email text,
  client_company text,
  portal_enabled boolean not null default false,
  color text,
  icon text,
  cover_image text,
  description text,
  tags text[] not null default '{}',
  sort_order int not null default 0,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index folders_workspace_division_idx on public.folders(workspace_id, division_id, sort_order);
create index folders_parent_idx on public.folders(parent_id);

alter table public.folders enable row level security;

create policy folders_select_members on public.folders
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy folders_insert_members on public.folders
  for insert to authenticated with check (public.is_workspace_member(auth.uid(), workspace_id));
create policy folders_update_members on public.folders
  for update to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy folders_delete_members on public.folders
  for delete to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));

create trigger folders_set_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

-- PROJECTS: link to division + optional folder
alter table public.projects add column if not exists division_id uuid references public.divisions(id) on delete set null;
alter table public.projects add column if not exists folder_id uuid references public.folders(id) on delete set null;
create index if not exists projects_division_idx on public.projects(division_id);
create index if not exists projects_folder_idx on public.projects(folder_id);

-- Seed default divisions for every workspace and backfill projects under Delivery
do $$
declare
  ws record;
  delivery_id uuid;
begin
  for ws in select id from public.workspaces loop
    -- Delivery
    insert into public.divisions (workspace_id, name, slug, icon, color, division_type, is_default, sort_order)
    values (ws.id, 'Delivery', 'delivery', 'briefcase', '#8b5cf6', 'delivery', true, 0)
    on conflict (workspace_id, slug) do nothing
    returning id into delivery_id;

    if delivery_id is null then
      select id into delivery_id from public.divisions where workspace_id = ws.id and slug = 'delivery';
    end if;

    -- Ops
    insert into public.divisions (workspace_id, name, slug, icon, color, division_type, sort_order)
    values (ws.id, 'Ops', 'ops', 'settings-2', '#10b981', 'operations', 1)
    on conflict (workspace_id, slug) do nothing;

    -- Sales
    insert into public.divisions (workspace_id, name, slug, icon, color, division_type, sort_order)
    values (ws.id, 'Sales', 'sales', 'trending-up', '#f59e0b', 'sales', 2)
    on conflict (workspace_id, slug) do nothing;

    -- Backfill: all projects in this workspace go under Delivery
    update public.projects
       set division_id = delivery_id
     where workspace_id = ws.id and division_id is null;
  end loop;
end $$;

-- Auto-seed default divisions when a new workspace is created
create or replace function public.seed_default_divisions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.divisions (workspace_id, name, slug, icon, color, division_type, is_default, sort_order)
  values (new.id, 'Delivery', 'delivery', 'briefcase', '#8b5cf6', 'delivery', true, 0)
  on conflict (workspace_id, slug) do nothing;

  insert into public.divisions (workspace_id, name, slug, icon, color, division_type, sort_order)
  values (new.id, 'Ops', 'ops', 'settings-2', '#10b981', 'operations', 1)
  on conflict (workspace_id, slug) do nothing;

  insert into public.divisions (workspace_id, name, slug, icon, color, division_type, sort_order)
  values (new.id, 'Sales', 'sales', 'trending-up', '#f59e0b', 'sales', 2)
  on conflict (workspace_id, slug) do nothing;

  return new;
end;
$$;

drop trigger if exists workspaces_seed_divisions on public.workspaces;
create trigger workspaces_seed_divisions
  after insert on public.workspaces
  for each row execute function public.seed_default_divisions();
