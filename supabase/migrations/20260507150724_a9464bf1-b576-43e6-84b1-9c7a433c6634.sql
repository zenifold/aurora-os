create table if not exists public.error_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid,
  message text not null,
  stack text,
  url text,
  route text,
  user_agent text,
  severity text not null default 'error',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_reports_workspace_created on public.error_reports(workspace_id, created_at desc);
create index if not exists idx_error_reports_user on public.error_reports(user_id);

alter table public.error_reports enable row level security;

create policy "Workspace members can view their workspace errors"
  on public.error_reports for select
  to authenticated
  using (workspace_id is null and user_id = auth.uid()
         or workspace_id is not null and public.is_workspace_member(auth.uid(), workspace_id));

create policy "Authenticated users can insert error reports"
  on public.error_reports for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "Anonymous can insert error reports"
  on public.error_reports for insert
  to anon
  with check (user_id is null);