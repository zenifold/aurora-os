ALTER TABLE public.ai_task_assignments
  ADD COLUMN IF NOT EXISTS parent_assignment_id uuid REFERENCES public.ai_task_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS depth integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tool_calls jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ai_task_assignments_parent ON public.ai_task_assignments(parent_assignment_id);