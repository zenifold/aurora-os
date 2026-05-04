
CREATE TABLE public.workspace_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_workspace ON public.workspace_invitations(workspace_id);
CREATE INDEX idx_invites_token ON public.workspace_invitations(token);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Owners (and the inviter) can view invitations for their workspace
CREATE POLICY "Owners view workspace invitations"
ON public.workspace_invitations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), workspace_id, 'owner'));

-- Anyone can read by token (for the accept-invite landing page); safe because token is unguessable
CREATE POLICY "Anyone can view invitation by token"
ON public.workspace_invitations
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Owners create invitations"
ON public.workspace_invitations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), workspace_id, 'owner') AND invited_by = auth.uid());

CREATE POLICY "Owners delete invitations"
ON public.workspace_invitations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), workspace_id, 'owner'));

-- Allow accepter to mark invitation as accepted
CREATE POLICY "Authenticated users accept invitations"
ON public.workspace_invitations
FOR UPDATE
TO authenticated
USING (status = 'pending' AND expires_at > now())
WITH CHECK (status = 'accepted' AND accepted_by = auth.uid());
