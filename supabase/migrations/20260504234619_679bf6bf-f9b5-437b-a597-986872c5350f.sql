-- 1. Add task_type column with check constraint
alter table public.tasks
  add column if not exists task_type text not null default 'task'
    check (task_type in ('initiative','epic','task','subtask'));

-- 2. Roll-up + hierarchy columns
alter table public.tasks
  add column if not exists rollup_progress int check (rollup_progress between 0 and 100),
  add column if not exists child_count int not null default 0,
  add column if not exists completed_child_count int not null default 0,
  add column if not exists hierarchy_path uuid[] not null default '{}';

-- 3. Indexes
create index if not exists idx_tasks_parent on public.tasks(parent_task_id);
create index if not exists idx_tasks_type on public.tasks(task_type);
create index if not exists idx_tasks_hierarchy on public.tasks using gin(hierarchy_path);

-- 4. Validate parent/child type combinations + maintain hierarchy_path
create or replace function public.validate_task_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_type text;
  parent_path uuid[];
begin
  if new.parent_task_id is null then
    -- top-level: only initiative and task may be top-level (epic/subtask need a parent)
    if new.task_type in ('epic','subtask') then
      raise exception '% must have a parent', new.task_type;
    end if;
    new.hierarchy_path := array[]::uuid[];
    return new;
  end if;

  select task_type, hierarchy_path
    into parent_type, parent_path
    from public.tasks where id = new.parent_task_id;

  if parent_type is null then
    raise exception 'Parent task not found';
  end if;

  -- enforce strict parent/child rules
  if (new.task_type = 'initiative') then
    raise exception 'Initiative cannot have a parent';
  elsif (new.task_type = 'epic'    and parent_type <> 'initiative') then
    raise exception 'Epic parent must be Initiative (got %)', parent_type;
  elsif (new.task_type = 'task'    and parent_type <> 'epic') then
    raise exception 'Task parent must be Epic (got %)', parent_type;
  elsif (new.task_type = 'subtask' and parent_type <> 'task') then
    raise exception 'Subtask parent must be Task (got %)', parent_type;
  end if;

  new.hierarchy_path := parent_path || new.parent_task_id;
  return new;
end;
$$;

drop trigger if exists trg_validate_task_hierarchy on public.tasks;
create trigger trg_validate_task_hierarchy
before insert or update of parent_task_id, task_type
on public.tasks
for each row execute function public.validate_task_hierarchy();

-- 5. Maintain rollup counts on parents (simple count average)
create or replace function public.recalc_task_rollup(_parent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
  done_n int;
begin
  if _parent_id is null then return; end if;
  select count(*), count(*) filter (where status = 'done')
    into total, done_n
    from public.tasks where parent_task_id = _parent_id;

  update public.tasks
     set child_count = total,
         completed_child_count = done_n,
         rollup_progress = case when total = 0 then null
                                else round((done_n::numeric / total) * 100)::int end
   where id = _parent_id;
end;
$$;

create or replace function public.tasks_rollup_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalc_task_rollup(new.parent_task_id);
  elsif tg_op = 'UPDATE' then
    if coalesce(new.parent_task_id::text,'') is distinct from coalesce(old.parent_task_id::text,'')
       or new.status is distinct from old.status then
      perform public.recalc_task_rollup(old.parent_task_id);
      perform public.recalc_task_rollup(new.parent_task_id);
    end if;
  elsif tg_op = 'DELETE' then
    perform public.recalc_task_rollup(old.parent_task_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_tasks_rollup on public.tasks;
create trigger trg_tasks_rollup
after insert or update or delete on public.tasks
for each row execute function public.tasks_rollup_trigger();

-- 6. Backfill rollup counts for existing parents
update public.tasks p set
  child_count = sub.cnt,
  completed_child_count = sub.done_n,
  rollup_progress = case when sub.cnt = 0 then null
                         else round((sub.done_n::numeric / sub.cnt) * 100)::int end
from (
  select parent_task_id, count(*) as cnt, count(*) filter (where status='done') as done_n
  from public.tasks where parent_task_id is not null
  group by parent_task_id
) sub
where p.id = sub.parent_task_id;

-- 7. Backfill hierarchy_path for existing tasks (one level only since no existing types use deeper nesting)
update public.tasks c
set hierarchy_path = array[c.parent_task_id]
where c.parent_task_id is not null and array_length(c.hierarchy_path,1) is null;