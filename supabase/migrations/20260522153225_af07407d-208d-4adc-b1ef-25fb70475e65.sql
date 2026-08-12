
-- 1. calendar_events INSERT policy
CREATE POLICY "calendar_events_insert_own"
ON public.calendar_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_workspace_member(auth.uid(), workspace_id)
);

-- 2. profiles: restrict SELECT to shared-workspace viewers (+ self)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;

CREATE POLICY "profiles_select_shared_workspace"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm_self
    JOIN public.workspace_members wm_other
      ON wm_other.workspace_id = wm_self.workspace_id
    WHERE wm_self.user_id = auth.uid()
      AND wm_other.user_id = profiles.id
  )
);

-- 3. proposals: fix swapped is_workspace_member args
DROP POLICY IF EXISTS proposals_select_members ON public.proposals;
DROP POLICY IF EXISTS proposals_insert_members ON public.proposals;
DROP POLICY IF EXISTS proposals_update_members ON public.proposals;
DROP POLICY IF EXISTS proposals_delete_members ON public.proposals;

CREATE POLICY proposals_select_members ON public.proposals
FOR SELECT TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY proposals_insert_members ON public.proposals
FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY proposals_update_members ON public.proposals
FOR UPDATE TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id))
WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY proposals_delete_members ON public.proposals
FOR DELETE TO authenticated
USING (public.is_workspace_member(auth.uid(), workspace_id));

-- 4. user_badges: restrict to shared-workspace viewers
DROP POLICY IF EXISTS "user_badges_select_all" ON public.user_badges;
DROP POLICY IF EXISTS "User badges are viewable by everyone" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_public_select" ON public.user_badges;

CREATE POLICY "user_badges_select_shared_workspace"
ON public.user_badges
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm_self
    JOIN public.workspace_members wm_other
      ON wm_other.workspace_id = wm_self.workspace_id
    WHERE wm_self.user_id = auth.uid()
      AND wm_other.user_id = user_badges.user_id
  )
);
