CREATE OR REPLACE FUNCTION public.validate_task_hierarchy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  parent_path uuid[];
begin
  if new.parent_task_id is null then
    -- top-level: epic must have a parent (initiative); subtask was historically required to have one but
    -- with infinite depth we allow it under any non-initiative parent only. At root, only initiative or task allowed.
    if new.task_type = 'epic' then
      raise exception 'Epic must have a parent initiative';
    end if;
    new.hierarchy_path := array[]::uuid[];
    return new;
  end if;

  -- Initiatives may never have a parent
  if new.task_type = 'initiative' then
    raise exception 'Initiative cannot have a parent';
  end if;

  -- Self-parent guard
  if new.parent_task_id = new.id then
    raise exception 'Task cannot be its own parent';
  end if;

  select hierarchy_path into parent_path
    from public.tasks where id = new.parent_task_id;

  if parent_path is null and not exists (select 1 from public.tasks where id = new.parent_task_id) then
    raise exception 'Parent task not found';
  end if;

  -- Cycle guard: parent's hierarchy_path must not contain this task
  if parent_path is not null and new.id = ANY(parent_path) then
    raise exception 'Cycle detected in task hierarchy';
  end if;

  new.hierarchy_path := coalesce(parent_path, '{}'::uuid[]) || new.parent_task_id;
  return new;
end;
$function$;