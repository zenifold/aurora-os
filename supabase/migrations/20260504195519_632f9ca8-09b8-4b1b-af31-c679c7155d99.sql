create or replace function public.notify_task_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_assignees uuid[];
  old_assignees uuid[];
  added uuid;
  actor uuid := auth.uid();
begin
  new_assignees := coalesce(new.assignee_ids, '{}');
  if tg_op = 'UPDATE' then
    old_assignees := coalesce(old.assignee_ids, '{}');
  else
    old_assignees := '{}';
  end if;

  foreach added in array new_assignees loop
    if added is null then continue; end if;
    if added = any(old_assignees) then continue; end if;
    if added = actor then continue; end if;
    insert into public.notifications (workspace_id, recipient_id, actor_id, type, title, body, link, task_id, project_id)
    values (
      new.workspace_id,
      added,
      actor,
      'assigned',
      'You were assigned to a task',
      new.title,
      '/app/p/' || new.project_id::text,
      new.id,
      new.project_id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists tasks_notify_assignments on public.tasks;
create trigger tasks_notify_assignments
after insert or update of assignee_ids on public.tasks
for each row execute function public.notify_task_assignments();