-- Recurring tasks: add recurrence rule + template metadata
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent ON public.tasks(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

-- Function: when a recurring task is marked done, spawn the next occurrence
CREATE OR REPLACE FUNCTION public.spawn_next_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb;
  freq text;
  interval_n int;
  base_date date;
  next_due date;
  next_start date;
  new_id uuid;
BEGIN
  -- only act when status transitions to done and there's a recurrence rule
  IF NEW.status <> 'done' THEN RETURN NEW; END IF;
  IF OLD.status = 'done' THEN RETURN NEW; END IF;
  IF NEW.recurrence IS NULL THEN RETURN NEW; END IF;

  rec := NEW.recurrence;
  freq := lower(coalesce(rec->>'freq', 'none'));
  interval_n := greatest(1, coalesce((rec->>'interval')::int, 1));

  IF freq NOT IN ('daily','weekly','monthly','yearly') THEN
    RETURN NEW;
  END IF;

  base_date := coalesce(NEW.due_date, current_date);

  next_due := CASE freq
    WHEN 'daily'   THEN base_date + (interval_n || ' days')::interval
    WHEN 'weekly'  THEN base_date + (interval_n || ' weeks')::interval
    WHEN 'monthly' THEN base_date + (interval_n || ' months')::interval
    WHEN 'yearly'  THEN base_date + (interval_n || ' years')::interval
  END;

  -- preserve start_date offset relative to due_date when present
  IF NEW.start_date IS NOT NULL AND NEW.due_date IS NOT NULL THEN
    next_start := next_due - (NEW.due_date - NEW.start_date);
  ELSE
    next_start := NULL;
  END IF;

  -- guard against an explicit end date
  IF rec ? 'until' AND (rec->>'until')::date < next_due THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tasks (
    project_id, workspace_id, title, description, status, priority,
    assignee_ids, due_date, start_date, parent_task_id, custom_values,
    tags, position, created_by, recurrence, recurrence_parent_id
  ) VALUES (
    NEW.project_id, NEW.workspace_id, NEW.title, NEW.description,
    coalesce((rec->>'next_status'), 'todo'),
    NEW.priority, NEW.assignee_ids, next_due, next_start,
    NEW.parent_task_id, NEW.custom_values, NEW.tags,
    NEW.position + 0.0001, NEW.created_by, NEW.recurrence,
    coalesce(NEW.recurrence_parent_id, NEW.id)
  )
  RETURNING id INTO new_id;

  -- the completed task is no longer the "template" — clear recurrence on it
  UPDATE public.tasks SET recurrence = NULL WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spawn_next_recurring ON public.tasks;
CREATE TRIGGER trg_spawn_next_recurring
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.spawn_next_recurring_task();