-- Tier 2: User preferences
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  density text NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact','ultra')),
  font_size text NOT NULL DEFAULT 'default' CHECK (font_size IN ('small','default','large','xlarge')),
  reduced_motion boolean NOT NULL DEFAULT false,
  high_contrast boolean NOT NULL DEFAULT false,
  default_landing text NOT NULL DEFAULT 'dashboard',
  default_view_type text NOT NULL DEFAULT 'table' CHECK (default_view_type IN ('table','kanban','calendar')),
  confirm_deletes text NOT NULL DEFAULT 'always' CHECK (confirm_deletes IN ('always','bulk','never')),
  accent_preference text NOT NULL DEFAULT 'workspace',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_prefs_select_own ON public.user_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_prefs_insert_own ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_prefs_update_own ON public.user_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_prefs_delete_own ON public.user_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tier 3: Project status workflow
-- Stored as JSONB array on projects.settings: {status_workflow: [{id, name, color, category, wip_limit}]}
-- No schema change needed (settings jsonb already exists on projects).

-- Tier 4: View configurations
-- views.config jsonb already exists. We will store:
-- { table: { columns: [{field, width, visible, pinned}], rowHeight, striping }, kanban: { groupBy, cardFields, columnWidth, wipLimits, swimlanes } }
-- No schema change needed.