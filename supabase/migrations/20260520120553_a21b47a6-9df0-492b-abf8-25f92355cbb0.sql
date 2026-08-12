-- Strategy Canvas: project-level Excalidraw surfaces
create table public.project_canvases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Untitled canvas',
  scene jsonb not null default '{"type":"excalidraw","elements":[],"appState":{},"files":{}}'::jsonb,
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_project_canvases_project on public.project_canvases(project_id);
create index idx_project_canvases_workspace on public.project_canvases(workspace_id);

alter table public.project_canvases enable row level security;

create policy "project_canvases_select_members" on public.project_canvases
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "project_canvases_insert_members" on public.project_canvases
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy "project_canvases_update_members" on public.project_canvases
  for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "project_canvases_delete_members" on public.project_canvases
  for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create trigger trg_project_canvases_updated
  before update on public.project_canvases
  for each row execute function public.set_updated_at();