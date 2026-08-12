
create table if not exists public.workspace_ai_memory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  kind text not null default 'fact' check (kind in ('fact','preference','style','other')),
  pinned boolean not null default true,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_ai_memory_ws_idx
  on public.workspace_ai_memory (workspace_id, sort_order, created_at);

alter table public.workspace_ai_memory enable row level security;

drop policy if exists "members view ai memory" on public.workspace_ai_memory;
create policy "members view ai memory" on public.workspace_ai_memory
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.workspace_id = workspace_ai_memory.workspace_id
      and ur.user_id = auth.uid()
  ));

drop policy if exists "managers manage ai memory" on public.workspace_ai_memory;
create policy "managers manage ai memory" on public.workspace_ai_memory
  for all to authenticated
  using (exists (
    select 1 from public.user_roles ur
    where ur.workspace_id = workspace_ai_memory.workspace_id
      and ur.user_id = auth.uid()
      and ur.role in ('owner','admin','manager')
  ))
  with check (exists (
    select 1 from public.user_roles ur
    where ur.workspace_id = workspace_ai_memory.workspace_id
      and ur.user_id = auth.uid()
      and ur.role in ('owner','admin','manager')
  ));

create or replace function public.touch_workspace_ai_memory()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_ai_memory_touch on public.workspace_ai_memory;
create trigger workspace_ai_memory_touch
  before update on public.workspace_ai_memory
  for each row execute function public.touch_workspace_ai_memory();
