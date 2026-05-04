REVOKE EXECUTE ON FUNCTION public.spawn_next_recurring_task() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_task_assignments() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_comment_mentions() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;