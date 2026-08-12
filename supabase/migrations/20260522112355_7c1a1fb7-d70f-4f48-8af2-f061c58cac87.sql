
-- Calendar integrations: per-user OAuth + synced calendar events
CREATE TABLE IF NOT EXISTS public.user_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','microsoft')),
  provider_account_email text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, provider)
);

ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Only the owning user can see/manage their connection. Tokens never go to other members.
CREATE POLICY "owner select calendar connection"
  ON public.user_calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "owner update calendar connection"
  ON public.user_calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "owner delete calendar connection"
  ON public.user_calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Inserts go through server fn (service role). No INSERT policy for users.

-- Synced calendar events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  ical_uid text,
  title text NOT NULL,
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  organizer_email text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  conference_url text,
  conference_kind text CHECK (conference_kind IN ('zoom','meet','teams','webex','other','none')),
  status text DEFAULT 'confirmed',
  html_link text,
  linked_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  auto_capture_enabled boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_user_start_idx
  ON public.calendar_events (user_id, start_at);
CREATE INDEX IF NOT EXISTS calendar_events_workspace_start_idx
  ON public.calendar_events (workspace_id, start_at);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select calendar events"
  ON public.calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "owner update calendar events"
  ON public.calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "owner delete calendar events"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Extend meetings to link to source calendar event + conference URL
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conference_url text,
  ADD COLUMN IF NOT EXISTS auto_capture_enabled boolean NOT NULL DEFAULT false;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_user_calendar_connections_updated ON public.user_calendar_connections;
CREATE TRIGGER trg_user_calendar_connections_updated
  BEFORE UPDATE ON public.user_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_calendar_events_updated ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
