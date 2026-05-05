-- =========================
-- Meetings
-- =========================
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid,

  title text not null,
  description text,
  platform text not null default 'manual_upload',

  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  duration_seconds int,

  transcript_raw_text text,
  transcript jsonb,

  summary jsonb,
  action_items jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,

  ai_status text not null default 'pending' check (ai_status in ('pending','processing','completed','failed')),
  ai_model text,
  ai_error text,

  visibility text not null default 'workspace' check (visibility in ('private','attendees','workspace')),

  organizer_id uuid,
  participant_emails text[] not null default '{}',

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meetings_workspace on public.meetings(workspace_id, created_at desc);
create index idx_meetings_project on public.meetings(project_id);

alter table public.meetings enable row level security;

create policy "meetings_select_members" on public.meetings
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "meetings_insert_members" on public.meetings
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id));
create policy "meetings_update_members" on public.meetings
  for update to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "meetings_delete_members" on public.meetings
  for delete to authenticated using (is_workspace_member(auth.uid(), workspace_id));

create trigger meetings_set_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

-- =========================
-- Meeting action items
-- =========================
create table public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null references public.meetings(id) on delete cascade,

  original_text text not null,
  summary text,
  context_quote text,

  assignee_guess_name text,
  assignee_guess_user_id uuid,
  due_guess date,
  priority_guess text check (priority_guess in ('low','medium','high','urgent')),

  status text not null default 'pending' check (status in ('pending','converted','assigned_to_ai','dismissed','completed')),
  converted_task_id uuid,
  assigned_agent_id uuid,

  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mai_meeting on public.meeting_action_items(meeting_id, position);
create index idx_mai_workspace on public.meeting_action_items(workspace_id);

alter table public.meeting_action_items enable row level security;

create policy "mai_select_members" on public.meeting_action_items
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "mai_insert_members" on public.meeting_action_items
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id));
create policy "mai_update_members" on public.meeting_action_items
  for update to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "mai_delete_members" on public.meeting_action_items
  for delete to authenticated using (is_workspace_member(auth.uid(), workspace_id));

create trigger mai_set_updated_at before update on public.meeting_action_items
  for each row execute function public.set_updated_at();

-- =========================
-- Meeting participants
-- =========================
create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid,
  email text not null,
  name text,
  role text default 'required' check (role in ('organizer','required','optional','bot','guest')),
  speaking_time_seconds int default 0,
  created_at timestamptz not null default now(),
  unique (meeting_id, email)
);

create index idx_mp_meeting on public.meeting_participants(meeting_id);

alter table public.meeting_participants enable row level security;

create policy "mp_select_members" on public.meeting_participants
  for select to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "mp_insert_members" on public.meeting_participants
  for insert to authenticated with check (is_workspace_member(auth.uid(), workspace_id));
create policy "mp_update_members" on public.meeting_participants
  for update to authenticated using (is_workspace_member(auth.uid(), workspace_id));
create policy "mp_delete_members" on public.meeting_participants
  for delete to authenticated using (is_workspace_member(auth.uid(), workspace_id));