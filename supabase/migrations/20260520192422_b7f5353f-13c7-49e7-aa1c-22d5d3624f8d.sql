
-- 1. Extend profiles with rich personalization fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS pronouns TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS accomplishments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS accent_color TEXT;

-- 2. Badge catalog (system-defined achievements)
CREATE TABLE IF NOT EXISTS public.badges (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,             -- lucide icon name OR emoji
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','legendary')),
  category TEXT NOT NULL DEFAULT 'general',
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges readable to all authenticated" ON public.badges;
CREATE POLICY "badges readable to all authenticated"
  ON public.badges FOR SELECT TO authenticated USING (true);

-- 3. Earned badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL REFERENCES public.badges(key) ON DELETE CASCADE,
  workspace_id UUID,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  pinned BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_badges readable to all authenticated" ON public.user_badges;
CREATE POLICY "user_badges readable to all authenticated"
  ON public.user_badges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_badges pin own" ON public.user_badges;
CREATE POLICY "user_badges pin own"
  ON public.user_badges FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Inserts happen via security-definer server functions / admin client.

-- 4. Seed the initial badge catalog
INSERT INTO public.badges (key, name, description, icon, color, tier, category, criteria, sort_order) VALUES
  ('first_task',       'First Steps',      'Completed your first task.',                 '✅', '#10b981', 'bronze',   'productivity', '{"tasks_completed": 1}',     1),
  ('task_10',          'Getting Going',    'Completed 10 tasks.',                        '🏃', '#10b981', 'bronze',   'productivity', '{"tasks_completed": 10}',    2),
  ('task_100',         'Centurion',        'Completed 100 tasks.',                       '💯', '#3b82f6', 'silver',   'productivity', '{"tasks_completed": 100}',   3),
  ('task_1000',        'Task Master',      'Completed 1,000 tasks.',                     '🏆', '#f59e0b', 'gold',     'productivity', '{"tasks_completed": 1000}',  4),
  ('streak_7',         'On a Roll',        '7-day activity streak.',                     '🔥', '#ef4444', 'bronze',   'consistency', '{"streak_days": 7}',          10),
  ('streak_30',        'Unstoppable',      '30-day activity streak.',                    '⚡', '#ef4444', 'silver',   'consistency', '{"streak_days": 30}',         11),
  ('streak_100',       'Legendary Streak', '100-day activity streak.',                   '🌟', '#fbbf24', 'legendary','consistency', '{"streak_days": 100}',        12),
  ('first_project',    'Project Pilot',    'Created your first project.',                '🚀', '#8b5cf6', 'bronze',   'leadership', '{"projects_created": 1}',     20),
  ('project_lead_5',   'Captain',          'Led 5 projects.',                            '🧭', '#8b5cf6', 'silver',   'leadership', '{"projects_created": 5}',     21),
  ('first_meeting',    'Conversationalist','Hosted your first meeting.',                 '🎙️', '#06b6d4', 'bronze',   'collaboration', '{"meetings_hosted": 1}',   30),
  ('meeting_50',       'Convener',         'Hosted 50 meetings.',                        '🗣️', '#06b6d4', 'silver',   'collaboration', '{"meetings_hosted": 50}',  31),
  ('first_note',       'Note Taker',       'Wrote your first note.',                     '📝', '#f59e0b', 'bronze',   'knowledge', '{"notes_created": 1}',         40),
  ('note_50',          'Knowledge Keeper', 'Wrote 50 notes.',                            '📚', '#f59e0b', 'silver',   'knowledge', '{"notes_created": 50}',        41),
  ('mentioned_10',     'Influencer',       'Mentioned 10 times by teammates.',           '📣', '#ec4899', 'silver',   'collaboration', '{"mentions": 10}',          50),
  ('early_adopter',    'Early Adopter',    'Joined Aurora in the first wave.',           '🌅', '#fbbf24', 'gold',     'special', '{"manual": true}',              60),
  ('aura_ai_power',    'AI Whisperer',     'Asked Aura AI 50 questions.',                '🤖', '#a855f7', 'silver',   'special', '{"aura_messages": 50}',         61),
  ('night_owl',        'Night Owl',        'Did meaningful work after midnight.',        '🦉', '#6366f1', 'bronze',   'fun', '{"manual": true}',                 70),
  ('early_bird',       'Early Bird',       'Did meaningful work before 6am.',            '🐦', '#fbbf24', 'bronze',   'fun', '{"manual": true}',                 71)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  tier = EXCLUDED.tier,
  category = EXCLUDED.category,
  criteria = EXCLUDED.criteria,
  sort_order = EXCLUDED.sort_order;

-- 5. Helper: compute per-user stats (used by app + badge engine)
CREATE OR REPLACE FUNCTION public.compute_user_stats(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tasks_done INT;
  tasks_done_30d INT;
  projects_created INT;
  meetings_hosted INT;
  notes_created INT;
  mentions_recv INT;
  comments_written INT;
  streak INT := 0;
  d DATE;
  has_activity BOOLEAN;
BEGIN
  SELECT count(*) INTO tasks_done
    FROM public.tasks WHERE status = 'done' AND _user_id = ANY(assignee_ids);

  SELECT count(*) INTO tasks_done_30d
    FROM public.tasks
    WHERE status = 'done' AND _user_id = ANY(assignee_ids)
      AND updated_at > now() - interval '30 days';

  SELECT count(*) INTO projects_created
    FROM public.projects WHERE created_by = _user_id;

  SELECT count(*) INTO meetings_hosted
    FROM public.meetings WHERE created_by = _user_id;

  SELECT count(*) INTO notes_created
    FROM public.notes WHERE author_id = _user_id;

  SELECT count(*) INTO mentions_recv
    FROM public.notifications WHERE recipient_id = _user_id AND type = 'mention';

  SELECT count(*) INTO comments_written
    FROM public.comments WHERE author_id = _user_id;

  -- Streak: consecutive days back from today with any activity_log entry
  d := current_date;
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.activity_log
      WHERE actor_id = _user_id
        AND created_at >= d::timestamptz
        AND created_at < (d + 1)::timestamptz
    ) INTO has_activity;
    EXIT WHEN NOT has_activity OR streak > 365;
    streak := streak + 1;
    d := d - 1;
  END LOOP;

  RETURN jsonb_build_object(
    'tasks_completed', COALESCE(tasks_done, 0),
    'tasks_completed_30d', COALESCE(tasks_done_30d, 0),
    'projects_created', COALESCE(projects_created, 0),
    'meetings_hosted', COALESCE(meetings_hosted, 0),
    'notes_created', COALESCE(notes_created, 0),
    'mentions', COALESCE(mentions_recv, 0),
    'comments_written', COALESCE(comments_written, 0),
    'streak_days', streak
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_user_stats(UUID) TO authenticated;

-- 6. Badge engine: award any unearned badges whose threshold is met
CREATE OR REPLACE FUNCTION public.evaluate_badges_for(_user_id UUID)
RETURNS SETOF public.user_badges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats JSONB := public.compute_user_stats(_user_id);
  b RECORD;
  threshold_met BOOLEAN;
BEGIN
  FOR b IN SELECT * FROM public.badges WHERE NOT (criteria ? 'manual') LOOP
    threshold_met := true;
    -- Each non-manual criterion must be <= stats value
    IF b.criteria ? 'tasks_completed'  AND COALESCE((stats->>'tasks_completed')::int, 0)  < (b.criteria->>'tasks_completed')::int  THEN threshold_met := false; END IF;
    IF b.criteria ? 'streak_days'      AND COALESCE((stats->>'streak_days')::int, 0)      < (b.criteria->>'streak_days')::int      THEN threshold_met := false; END IF;
    IF b.criteria ? 'projects_created' AND COALESCE((stats->>'projects_created')::int, 0) < (b.criteria->>'projects_created')::int THEN threshold_met := false; END IF;
    IF b.criteria ? 'meetings_hosted'  AND COALESCE((stats->>'meetings_hosted')::int, 0)  < (b.criteria->>'meetings_hosted')::int  THEN threshold_met := false; END IF;
    IF b.criteria ? 'notes_created'    AND COALESCE((stats->>'notes_created')::int, 0)    < (b.criteria->>'notes_created')::int    THEN threshold_met := false; END IF;
    IF b.criteria ? 'mentions'         AND COALESCE((stats->>'mentions')::int, 0)         < (b.criteria->>'mentions')::int         THEN threshold_met := false; END IF;

    IF threshold_met THEN
      INSERT INTO public.user_badges (user_id, badge_key, meta)
      VALUES (_user_id, b.key, jsonb_build_object('stats_at_award', stats))
      ON CONFLICT (user_id, badge_key) DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY SELECT * FROM public.user_badges WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_badges_for(UUID) TO authenticated;
