-- Aura Notes core schema
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid,
  created_by uuid not null,
  title text,
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  note_type text not null default 'freeform' check (note_type in ('freeform','bullet_list','check_list','sketch')),
  background_color text not null default '#ffffff',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  converted_task_id uuid,
  reminder_at timestamptz,
  collaborator_ids uuid[] not null default '{}',
  pin_order int not null default 0,
  manual_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notes_workspace on public.notes(workspace_id);
create index if not exists idx_notes_pinned on public.notes(workspace_id, is_pinned, pin_order);
create index if not exists idx_notes_archived on public.notes(workspace_id, is_archived, updated_at desc);
create index if not exists idx_notes_project on public.notes(project_id);

alter table public.notes enable row level security;

create policy "notes_select_members"
  on public.notes for select
  to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "notes_insert_members"
  on public.notes for insert
  to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id) and auth.uid() = created_by);

create policy "notes_update_members"
  on public.notes for update
  to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id))
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy "notes_delete_members"
  on public.notes for delete
  to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create trigger trg_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Realtime
alter publication supabase_realtime add table public.notes;