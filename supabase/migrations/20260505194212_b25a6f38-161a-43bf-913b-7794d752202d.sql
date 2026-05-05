
create table public.sidebar_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_type text not null check (item_type in ('folder','project','division')),
  item_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id, item_type, item_id)
);

create index sidebar_favorites_user_ws_idx on public.sidebar_favorites (user_id, workspace_id, sort_order);

alter table public.sidebar_favorites enable row level security;

create policy "favorites_select_own" on public.sidebar_favorites
  for select to authenticated using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.sidebar_favorites
  for insert to authenticated with check (auth.uid() = user_id and is_workspace_member(auth.uid(), workspace_id));
create policy "favorites_update_own" on public.sidebar_favorites
  for update to authenticated using (auth.uid() = user_id);
create policy "favorites_delete_own" on public.sidebar_favorites
  for delete to authenticated using (auth.uid() = user_id);
