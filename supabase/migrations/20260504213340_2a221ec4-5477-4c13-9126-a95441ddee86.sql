-- Task relations table
CREATE TABLE public.task_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  source_task_id uuid NOT NULL,
  target_task_id uuid NOT NULL,
  relation_type text NOT NULL,
  lag_days integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_relations_type_check CHECK (
    relation_type IN ('blocks','blocked_by','relates_to','duplicates','follows')
  ),
  CONSTRAINT task_relations_no_self CHECK (source_task_id <> target_task_id),
  CONSTRAINT task_relations_unique UNIQUE (source_task_id, target_task_id, relation_type)
);

CREATE INDEX idx_task_relations_source ON public.task_relations(source_task_id);
CREATE INDEX idx_task_relations_target ON public.task_relations(target_task_id);
CREATE INDEX idx_task_relations_workspace ON public.task_relations(workspace_id);

ALTER TABLE public.task_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_relations_select_members
  ON public.task_relations FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY task_relations_insert_members
  ON public.task_relations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY task_relations_delete_members
  ON public.task_relations FOR DELETE
  TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));