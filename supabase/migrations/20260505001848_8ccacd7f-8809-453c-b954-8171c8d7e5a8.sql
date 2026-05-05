-- ============================================================
-- Workflow Builder — Phase 1 schema
-- ============================================================

-- 1. workflow_statuses ----------------------------------------
create table public.workflow_statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null default '#94a3b8',
  icon text not null default 'circle',
  category text not null check (category in ('backlog','todo','in_progress','review','done','cancelled')),
  order_index int not null default 0,
  is_start boolean not null default false,
  is_terminal boolean not null default false,
  wip_limit int,
  sla_hours int,
  auto_assign_to jsonb,
  entry_criteria jsonb not null default '[]'::jsonb,
  exit_criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create index idx_workflow_statuses_project on public.workflow_statuses(project_id, order_index);

alter table public.workflow_statuses enable row level security;

create policy ws_select_members on public.workflow_statuses
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy ws_insert_owner on public.workflow_statuses
  for insert to authenticated with check (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy ws_update_owner on public.workflow_statuses
  for update to authenticated using (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy ws_delete_owner on public.workflow_statuses
  for delete to authenticated using (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

create trigger workflow_statuses_updated_at
  before update on public.workflow_statuses
  for each row execute function public.set_updated_at();

-- 2. workflow_transitions -------------------------------------
create table public.workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  from_status_id uuid not null references public.workflow_statuses(id) on delete cascade,
  to_status_id uuid not null references public.workflow_statuses(id) on delete cascade,
  permission text not null default 'anyone'
    check (permission in ('anyone','assignee','creator','admin','manager','role_specific')),
  allowed_role text,
  gates jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  button_label text,
  confirmation_message text,
  created_at timestamptz not null default now(),
  unique (project_id, from_status_id, to_status_id)
);

create index idx_workflow_transitions_project on public.workflow_transitions(project_id);
create index idx_workflow_transitions_from on public.workflow_transitions(from_status_id);

alter table public.workflow_transitions enable row level security;

create policy wt_select_members on public.workflow_transitions
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy wt_insert_owner on public.workflow_transitions
  for insert to authenticated with check (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy wt_update_owner on public.workflow_transitions
  for update to authenticated using (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));
create policy wt_delete_owner on public.workflow_transitions
  for delete to authenticated using (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

-- 3. transition_approvals -------------------------------------
create table public.transition_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  transition_id uuid not null references public.workflow_transitions(id) on delete cascade,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  approver_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  comment text,
  decided_at timestamptz,
  unique (task_id, transition_id, approver_id)
);

create index idx_transition_approvals_task on public.transition_approvals(task_id);
create index idx_transition_approvals_approver on public.transition_approvals(approver_id, status);

alter table public.transition_approvals enable row level security;

create policy ta_select_members on public.transition_approvals
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy ta_insert_self on public.transition_approvals
  for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id) and auth.uid() = requested_by);
create policy ta_update_approver on public.transition_approvals
  for update to authenticated
  using (auth.uid() = approver_id and status = 'pending');
create policy ta_delete_requester on public.transition_approvals
  for delete to authenticated using (auth.uid() = requested_by and status = 'pending');

-- 4. task_status_history --------------------------------------
create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status_id uuid references public.workflow_statuses(id) on delete set null,
  to_status_id uuid references public.workflow_statuses(id) on delete set null,
  from_status_name text,
  to_status_name text,
  transition_id uuid references public.workflow_transitions(id) on delete set null,
  triggered_by jsonb not null default '{}'::jsonb,
  entered_at timestamptz not null default now(),
  left_at timestamptz
);

create index idx_task_status_history_task on public.task_status_history(task_id, entered_at desc);

alter table public.task_status_history enable row level security;

create policy tsh_select_members on public.task_status_history
  for select to authenticated using (public.is_workspace_member(auth.uid(), workspace_id));
create policy tsh_insert_members on public.task_status_history
  for insert to authenticated with check (public.is_workspace_member(auth.uid(), workspace_id));

-- 5. Add workflow_status_id to tasks --------------------------
alter table public.tasks
  add column workflow_status_id uuid references public.workflow_statuses(id) on delete set null;

create index idx_tasks_workflow_status on public.tasks(workflow_status_id);

-- 6. Helper: seed default workflow for a project ---------------
create or replace function public.seed_default_workflow(_project_id uuid, _workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s_backlog uuid;
  s_todo uuid;
  s_progress uuid;
  s_review uuid;
  s_done uuid;
  ids uuid[];
  from_id uuid;
  to_id uuid;
begin
  -- Skip if statuses already exist for this project
  if exists (select 1 from public.workflow_statuses where project_id = _project_id) then
    return;
  end if;

  insert into public.workflow_statuses (workspace_id, project_id, name, color, icon, category, order_index, is_start)
  values (_workspace_id, _project_id, 'Backlog', '#94a3b8', 'inbox', 'backlog', 0, false)
  returning id into s_backlog;

  insert into public.workflow_statuses (workspace_id, project_id, name, color, icon, category, order_index, is_start)
  values (_workspace_id, _project_id, 'Todo', '#64748b', 'circle', 'todo', 1, true)
  returning id into s_todo;

  insert into public.workflow_statuses (workspace_id, project_id, name, color, icon, category, order_index)
  values (_workspace_id, _project_id, 'In Progress', '#3b82f6', 'play', 'in_progress', 2)
  returning id into s_progress;

  insert into public.workflow_statuses (workspace_id, project_id, name, color, icon, category, order_index)
  values (_workspace_id, _project_id, 'In Review', '#a855f7', 'eye', 'review', 3)
  returning id into s_review;

  insert into public.workflow_statuses (workspace_id, project_id, name, color, icon, category, order_index, is_terminal)
  values (_workspace_id, _project_id, 'Done', '#10b981', 'check', 'done', 4, true)
  returning id into s_done;

  -- All-to-all transitions (anyone, no gates)
  ids := array[s_backlog, s_todo, s_progress, s_review, s_done];
  foreach from_id in array ids loop
    foreach to_id in array ids loop
      if from_id <> to_id then
        insert into public.workflow_transitions (workspace_id, project_id, from_status_id, to_status_id)
        values (_workspace_id, _project_id, from_id, to_id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end;
$$;

-- 7. Trigger: seed workflow on new project ---------------------
create or replace function public.projects_seed_workflow_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_workflow(new.id, new.workspace_id);
  return new;
end;
$$;

create trigger projects_seed_workflow
  after insert on public.projects
  for each row execute function public.projects_seed_workflow_trigger();

-- 8. Backfill existing projects --------------------------------
do $$
declare
  p record;
begin
  for p in select id, workspace_id from public.projects loop
    perform public.seed_default_workflow(p.id, p.workspace_id);
  end loop;
end $$;

-- 9. Backfill workflow_status_id on existing tasks -------------
-- Match by lowercased name; fallback by category (todo, in_progress, done).
update public.tasks t
set workflow_status_id = ws.id
from public.workflow_statuses ws
where ws.project_id = t.project_id
  and t.workflow_status_id is null
  and (
    lower(ws.name) = lower(t.status)
    or (lower(t.status) = 'todo' and ws.category = 'todo')
    or (lower(t.status) in ('in_progress','doing','in progress') and ws.category = 'in_progress')
    or (lower(t.status) in ('done','complete','closed') and ws.category = 'done')
    or (lower(t.status) in ('backlog') and ws.category = 'backlog')
    or (lower(t.status) in ('review','in_review','in review','code_review') and ws.category = 'review')
  );

-- For any still-unmatched tasks, fall back to the start status of their project
update public.tasks t
set workflow_status_id = (
  select id from public.workflow_statuses
  where project_id = t.project_id and is_start = true
  limit 1
)
where t.workflow_status_id is null;

-- 10. Trigger: keep tasks.status text mirrored & log history ---
create or replace function public.tasks_workflow_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_name text;
  old_name text;
begin
  if new.workflow_status_id is not null then
    select name into new_name from public.workflow_statuses where id = new.workflow_status_id;
    if new_name is not null then
      new.status := new_name;
    end if;
  end if;

  -- Only log on actual status change (or initial insert with a status)
  if tg_op = 'INSERT' then
    if new.workflow_status_id is not null then
      insert into public.task_status_history
        (workspace_id, task_id, from_status_id, to_status_id, from_status_name, to_status_name, triggered_by, entered_at)
      values
        (new.workspace_id, new.id, null, new.workflow_status_id, null, new_name,
         jsonb_build_object('type','user','id', coalesce(new.created_by, auth.uid())), now());
    end if;
    return new;
  end if;

  if new.workflow_status_id is distinct from old.workflow_status_id then
    if old.workflow_status_id is not null then
      select name into old_name from public.workflow_statuses where id = old.workflow_status_id;
      -- Close out previous history row
      update public.task_status_history
        set left_at = now()
      where task_id = new.id
        and to_status_id = old.workflow_status_id
        and left_at is null;
    end if;

    if new.workflow_status_id is not null then
      insert into public.task_status_history
        (workspace_id, task_id, from_status_id, to_status_id, from_status_name, to_status_name, triggered_by, entered_at)
      values
        (new.workspace_id, new.id, old.workflow_status_id, new.workflow_status_id, old_name, new_name,
         jsonb_build_object('type','user','id', auth.uid()), now());
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_workflow_sync
  before insert or update of workflow_status_id on public.tasks
  for each row execute function public.tasks_workflow_sync_trigger();

-- 11. Realtime ------------------------------------------------
alter publication supabase_realtime add table public.workflow_statuses;
alter publication supabase_realtime add table public.workflow_transitions;
alter publication supabase_realtime add table public.transition_approvals;
alter publication supabase_realtime add table public.task_status_history;