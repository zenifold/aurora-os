create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('folder','page','canvas','plan','project')),
  mode text not null check (mode in ('one_shot','agentic')),
  prompt text not null,
  destination jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  progress jsonb not null default '[]'::jsonb,
  result_kind text,
  result_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index agent_runs_ws_status_idx on public.agent_runs(workspace_id, status);
create index agent_runs_user_idx on public.agent_runs(user_id, created_at desc);

alter table public.agent_runs enable row level security;

create policy "Workspace members read agent runs"
  on public.agent_runs for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));

create policy "Users insert their own agent runs"
  on public.agent_runs for insert to authenticated
  with check (auth.uid() = user_id and public.is_workspace_member(auth.uid(), workspace_id));

create policy "Users update their own agent runs"
  on public.agent_runs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger agent_runs_updated_at
  before update on public.agent_runs
  for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.agent_runs;
alter table public.agent_runs replica identity full;

-- accept invitation by token (uses existing workspace_invitations)
create or replace function public.accept_workspace_invitation(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv record;
  user_email text;
  inv_role workspace_role;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select email into user_email from auth.users where id = uid;

  select * into inv from public.workspace_invitations
    where token = _token and status = 'pending' and expires_at > now()
    limit 1;
  if inv.id is null then raise exception 'invitation not found or expired'; end if;
  if lower(inv.email) <> lower(user_email) then
    raise exception 'invitation email does not match your account';
  end if;

  begin
    inv_role := inv.role::workspace_role;
  exception when others then
    inv_role := 'member'::workspace_role;
  end;

  insert into public.workspace_members (workspace_id, user_id)
    values (inv.workspace_id, uid)
    on conflict do nothing;
  insert into public.user_roles (workspace_id, user_id, role)
    values (inv.workspace_id, uid, inv_role)
    on conflict do nothing;

  update public.workspace_invitations
    set status = 'accepted', accepted_at = now(), accepted_by = uid
    where id = inv.id;

  return inv.workspace_id;
end;
$$;