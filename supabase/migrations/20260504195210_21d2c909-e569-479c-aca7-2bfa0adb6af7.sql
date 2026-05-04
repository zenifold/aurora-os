create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  recipient_id uuid not null,
  actor_id uuid,
  type text not null,
  title text not null,
  body text,
  link text,
  task_id uuid,
  project_id uuid,
  comment_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (auth.uid() = recipient_id);

create policy "notifications_insert_members" on public.notifications
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = recipient_id);

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (auth.uid() = recipient_id);

alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity full;