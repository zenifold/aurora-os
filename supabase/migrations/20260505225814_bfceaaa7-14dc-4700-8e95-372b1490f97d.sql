-- Folder role enum
do $$ begin
  create type public.folder_role as enum ('viewer','editor','owner');
exception when duplicate_object then null; end $$;

-- folder_members
create table if not exists public.folder_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  folder_id uuid not null references public.folders(id) on delete cascade,
  user_id uuid not null,
  role public.folder_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (folder_id, user_id)
);
create index if not exists folder_members_user_idx on public.folder_members(user_id);
create index if not exists folder_members_folder_idx on public.folder_members(folder_id);

alter table public.folder_members enable row level security;

-- folder_invitations
create table if not exists public.folder_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  folder_id uuid not null references public.folders(id) on delete cascade,
  email text not null,
  role public.folder_role not null default 'viewer',
  invited_by uuid,
  token text not null default encode(gen_random_bytes(24),'hex'),
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
create index if not exists folder_invitations_folder_idx on public.folder_invitations(folder_id);
alter table public.folder_invitations enable row level security;

-- Helper: has_folder_access
create or replace function public.has_folder_access(_user_id uuid, _folder_id uuid, _min_level public.folder_role default 'viewer')
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare
  ws uuid;
  ws_owner uuid;
  cur uuid := _folder_id;
  found_role public.folder_role;
  level_rank int;
  found_rank int := -1;
begin
  level_rank := case _min_level when 'viewer' then 0 when 'editor' then 1 when 'owner' then 2 end;

  select workspace_id into ws from public.folders where id = _folder_id;
  if ws is null then return false; end if;

  -- workspace owner has full access
  select owner_id into ws_owner from public.workspaces where id = ws;
  if ws_owner = _user_id then return true; end if;
  if public.has_role(_user_id, ws, 'owner'::workspace_role) then return true; end if;

  -- walk folder ancestors looking for an explicit membership
  while cur is not null loop
    select role into found_role from public.folder_members
      where folder_id = cur and user_id = _user_id
      limit 1;
    if found_role is not null then
      found_rank := case found_role when 'viewer' then 0 when 'editor' then 1 when 'owner' then 2 end;
      exit;
    end if;
    select parent_id into cur from public.folders where id = cur;
  end loop;

  return found_rank >= level_rank;
end;
$$;

-- folder_members RLS
drop policy if exists fm_select on public.folder_members;
create policy fm_select on public.folder_members for select to authenticated
  using (is_workspace_member(auth.uid(), workspace_id));

drop policy if exists fm_insert on public.folder_members;
create policy fm_insert on public.folder_members for insert to authenticated
  with check (
    is_workspace_member(auth.uid(), workspace_id)
    and (
      has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
      or public.has_folder_access(auth.uid(), folder_id, 'owner')
    )
  );

drop policy if exists fm_update on public.folder_members;
create policy fm_update on public.folder_members for update to authenticated
  using (
    has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
    or public.has_folder_access(auth.uid(), folder_id, 'owner')
  );

drop policy if exists fm_delete on public.folder_members;
create policy fm_delete on public.folder_members for delete to authenticated
  using (
    has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
    or public.has_folder_access(auth.uid(), folder_id, 'owner')
    or user_id = auth.uid()
  );

-- folder_invitations RLS
drop policy if exists fi_select on public.folder_invitations;
create policy fi_select on public.folder_invitations for select to authenticated
  using (is_workspace_member(auth.uid(), workspace_id));

drop policy if exists fi_insert on public.folder_invitations;
create policy fi_insert on public.folder_invitations for insert to authenticated
  with check (
    is_workspace_member(auth.uid(), workspace_id)
    and (
      has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
      or public.has_folder_access(auth.uid(), folder_id, 'owner')
    )
  );

drop policy if exists fi_delete on public.folder_invitations;
create policy fi_delete on public.folder_invitations for delete to authenticated
  using (
    has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
    or public.has_folder_access(auth.uid(), folder_id, 'owner')
  );

-- user_saved_views: per-user personal task filter presets
create table if not exists public.user_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid not null,
  name text not null,
  icon text,
  filters jsonb not null default '[]'::jsonb,
  sorts jsonb not null default '[]'::jsonb,
  scope text not null default 'workspace', -- 'workspace' | 'mine'
  is_pinned boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists usv_user_idx on public.user_saved_views(user_id, workspace_id);

alter table public.user_saved_views enable row level security;

drop policy if exists usv_all_self on public.user_saved_views;
create policy usv_all_self on public.user_saved_views for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
