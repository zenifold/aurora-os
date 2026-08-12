
create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  link_kind text not null check (link_kind in ('page','plan','canvas','document','task')),
  target_id uuid not null,
  label text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (task_id, link_kind, target_id)
);

create index idx_task_links_task on public.task_links(task_id);
create index idx_task_links_target on public.task_links(target_id);

alter table public.task_links enable row level security;

create policy "task_links_select_member" on public.task_links
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "task_links_insert_member" on public.task_links
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id));

create policy "task_links_delete_member" on public.task_links
  for delete to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

alter publication supabase_realtime add table public.task_links;

create table public.ai_task_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null,
  messages jsonb not null default '[]'::jsonb,
  tool_calls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create index idx_ai_task_threads_task on public.ai_task_threads(task_id);

alter table public.ai_task_threads enable row level security;

create policy "ai_task_threads_select_member" on public.ai_task_threads
  for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "ai_task_threads_insert_own" on public.ai_task_threads
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_workspace_member(auth.uid(), workspace_id));

create policy "ai_task_threads_update_own" on public.ai_task_threads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ai_task_threads_delete_own" on public.ai_task_threads
  for delete to authenticated
  using (user_id = auth.uid());

create trigger ai_task_threads_set_updated
  before update on public.ai_task_threads
  for each row execute function public.set_updated_at();
