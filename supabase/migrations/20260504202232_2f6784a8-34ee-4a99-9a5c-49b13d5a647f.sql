create table public.workspace_ai_secrets (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  openrouter_api_key text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.workspace_ai_secrets enable row level security;

create policy "workspace_ai_secrets_select_owner" on public.workspace_ai_secrets
  for select to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));

create policy "workspace_ai_secrets_insert_owner" on public.workspace_ai_secrets
  for insert to authenticated
  with check (public.has_role(auth.uid(), workspace_id, 'owner'));

create policy "workspace_ai_secrets_update_owner" on public.workspace_ai_secrets
  for update to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));

create policy "workspace_ai_secrets_delete_owner" on public.workspace_ai_secrets
  for delete to authenticated
  using (public.has_role(auth.uid(), workspace_id, 'owner'));