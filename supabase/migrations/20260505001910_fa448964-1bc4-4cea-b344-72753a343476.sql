revoke all on function public.seed_default_workflow(uuid, uuid) from public, anon, authenticated;
revoke all on function public.projects_seed_workflow_trigger() from public, anon, authenticated;
revoke all on function public.tasks_workflow_sync_trigger() from public, anon, authenticated;