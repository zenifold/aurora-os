
-- Fix mutable search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

-- Revoke direct EXECUTE on SECURITY DEFINER helpers (they're used inside RLS policies, not called by clients)
revoke execute on function public.has_role(uuid, uuid, public.workspace_role) from public, anon, authenticated;
revoke execute on function public.is_workspace_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
