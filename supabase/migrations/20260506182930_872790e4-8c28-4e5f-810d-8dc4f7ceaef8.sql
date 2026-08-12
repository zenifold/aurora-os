UPDATE public.projects p
SET division_id = (
  SELECT id FROM public.divisions d
  WHERE d.workspace_id = p.workspace_id
  ORDER BY d.is_default DESC, d.sort_order ASC
  LIMIT 1
)
WHERE p.division_id IS NULL;