DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'maxkmurphy@gmail.com';
  IF uid IS NULL THEN
    RAISE NOTICE 'user not found';
    RETURN;
  END IF;

  -- Delete every workspace they own. FK cascades clean projects, tasks,
  -- folders, divisions, deals, contacts, notes, meetings, etc.
  DELETE FROM public.workspaces WHERE owner_id = uid;

  -- Drop any lingering memberships/roles in workspaces owned by others
  DELETE FROM public.workspace_members WHERE user_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;

  -- Reset profile so onboarding shows again
  DELETE FROM public.profiles WHERE id = uid;
END $$;