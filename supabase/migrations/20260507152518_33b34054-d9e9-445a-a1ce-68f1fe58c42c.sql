
CREATE TYPE public.channel_scope AS ENUM ('workspace','section','project','dm');

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  scope public.channel_scope NOT NULL,
  scope_id uuid NULL,
  name text NOT NULL,
  slug text NOT NULL,
  topic text NULL,
  is_private boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, scope, scope_id, slug)
);
CREATE INDEX channels_ws_scope_idx ON public.channels(workspace_id, scope, scope_id);

CREATE TABLE public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  last_read_at timestamptz NULL,
  muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
CREATE INDEX channel_members_user_idx ON public.channel_members(user_id);

CREATE TABLE public.channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  parent_message_id uuid NULL REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  author_id uuid NULL,
  body_md text NULL,
  body_json jsonb NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  attachments jsonb NOT NULL DEFAULT '[]',
  metadata jsonb NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  edited_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX channel_messages_channel_created_idx ON public.channel_messages(channel_id, created_at DESC);
CREATE INDEX channel_messages_parent_idx ON public.channel_messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

CREATE TABLE public.channel_reactions (
  message_id uuid NOT NULL REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  workspace_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE public.channel_pins (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  pinned_by uuid NULL,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, message_id)
);

CREATE OR REPLACE FUNCTION public.can_access_channel(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = _channel_id
      AND public.is_workspace_member(_user_id, c.workspace_id)
      AND (
        (c.is_private = false AND c.scope IN ('workspace','project','section'))
        OR EXISTS (SELECT 1 FROM public.channel_members m WHERE m.channel_id = c.id AND m.user_id = _user_id)
      )
  );
$$;

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY channels_select ON public.channels FOR SELECT TO authenticated
  USING (public.can_access_channel(auth.uid(), id));
CREATE POLICY channels_insert ON public.channels FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY channels_update ON public.channels FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
    OR EXISTS (SELECT 1 FROM public.channel_members m WHERE m.channel_id = id AND m.user_id = auth.uid() AND m.role = 'owner')
  );
CREATE POLICY channels_delete ON public.channels FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

CREATE POLICY channel_members_select ON public.channel_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY channel_members_insert ON public.channel_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role)
      OR EXISTS (SELECT 1 FROM public.channel_members m WHERE m.channel_id = channel_id AND m.user_id = auth.uid() AND m.role = 'owner')
    )
  );
CREATE POLICY channel_members_update_self ON public.channel_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY channel_members_delete ON public.channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

CREATE POLICY channel_messages_select ON public.channel_messages FOR SELECT TO authenticated
  USING (public.can_access_channel(auth.uid(), channel_id));
CREATE POLICY channel_messages_insert ON public.channel_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_channel(auth.uid(), channel_id)
    AND author_id = auth.uid()
    AND public.is_workspace_member(auth.uid(), workspace_id)
  );
CREATE POLICY channel_messages_update_author ON public.channel_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY channel_messages_delete_author ON public.channel_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), workspace_id, 'owner'::workspace_role));

CREATE POLICY channel_reactions_select ON public.channel_reactions FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY channel_reactions_insert ON public.channel_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.channel_messages m WHERE m.id = message_id AND public.can_access_channel(auth.uid(), m.channel_id))
  );
CREATE POLICY channel_reactions_delete ON public.channel_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY channel_pins_select ON public.channel_pins FOR SELECT TO authenticated
  USING (public.can_access_channel(auth.uid(), channel_id));
CREATE POLICY channel_pins_insert ON public.channel_pins FOR INSERT TO authenticated
  WITH CHECK (public.can_access_channel(auth.uid(), channel_id));
CREATE POLICY channel_pins_delete ON public.channel_pins FOR DELETE TO authenticated
  USING (public.can_access_channel(auth.uid(), channel_id));

CREATE TRIGGER channels_set_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_project_default_channel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.channels (workspace_id, scope, scope_id, name, slug, is_default, created_by)
  VALUES (NEW.workspace_id, 'project', NEW.id, 'general', 'general', true, NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_create_default_channel
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.create_project_default_channel();

INSERT INTO public.channels (workspace_id, scope, scope_id, name, slug, is_default, created_by)
SELECT p.workspace_id, 'project'::public.channel_scope, p.id, 'general', 'general', true, p.created_by
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.channels c
  WHERE c.scope = 'project' AND c.scope_id = p.id AND c.slug = 'general'
);

INSERT INTO public.channels (workspace_id, scope, scope_id, name, slug, is_default)
SELECT w.id, 'workspace'::public.channel_scope, NULL, 'general', 'general', true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.channels c
  WHERE c.workspace_id = w.id AND c.scope = 'workspace' AND c.slug = 'general'
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
ALTER TABLE public.channel_messages REPLICA IDENTITY FULL;
ALTER TABLE public.channel_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;
