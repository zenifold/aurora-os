
-- =========================================================================
-- 1. PORTAL ACTIVITY LOG: extend with new columns + canonical event types
-- =========================================================================

ALTER TABLE public.portal_activity_log
  ADD COLUMN IF NOT EXISTS client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_response boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unblocks_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS routed_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seen_by_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portal_session_id uuid,
  ADD COLUMN IF NOT EXISTS client_ip inet,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

-- Drop old project_id NOT NULL constraint to allow account-level events
ALTER TABLE public.portal_activity_log
  ALTER COLUMN project_id DROP NOT NULL;

-- Backfill client_account_id from project_id where missing
UPDATE public.portal_activity_log pal
SET client_account_id = p.client_account_id
FROM public.projects p
WHERE pal.project_id = p.id
  AND pal.client_account_id IS NULL;

-- Migrate legacy activity_type values to the canonical 6
UPDATE public.portal_activity_log
SET activity_type = CASE activity_type
  WHEN 'viewed_task' THEN 'login'
  WHEN 'completed_deliverable' THEN 'task_complete'
  WHEN 'commented' THEN 'task_comment'
  WHEN 'downloaded_file' THEN 'doc_upload'
  WHEN 'viewed_timeline' THEN 'login'
  WHEN 'acknowledged_impact' THEN 'approval_given'
  ELSE activity_type
END
WHERE activity_type IN ('viewed_task','completed_deliverable','commented','downloaded_file','viewed_timeline','acknowledged_impact');

-- Replace check constraint with the canonical 6
ALTER TABLE public.portal_activity_log DROP CONSTRAINT IF EXISTS portal_activity_log_activity_type_check;
ALTER TABLE public.portal_activity_log ADD CONSTRAINT portal_activity_log_activity_type_check
  CHECK (activity_type = ANY (ARRAY['task_complete','task_comment','doc_upload','status_update','login','approval_given']));

CREATE INDEX IF NOT EXISTS idx_pal_client_account ON public.portal_activity_log(client_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_requires_response ON public.portal_activity_log(client_account_id) WHERE requires_response = true AND responded_at IS NULL;

-- =========================================================================
-- 2. CLIENT PORTAL PULSE: one row per client with rolling engagement signals
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.client_portal_pulse (
  client_account_id uuid PRIMARY KEY REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  last_activity_at timestamptz,
  last_login_at timestamptz,
  open_client_tasks int NOT NULL DEFAULT 0,
  tasks_completed_7d int NOT NULL DEFAULT 0,
  docs_uploaded_7d int NOT NULL DEFAULT 0,
  avg_response_time_hrs numeric,
  engagement_score int NOT NULL DEFAULT 50,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cpp_workspace ON public.client_portal_pulse(workspace_id);

ALTER TABLE public.client_portal_pulse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpp_select_members" ON public.client_portal_pulse FOR SELECT
  TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "cpp_insert_members" ON public.client_portal_pulse FOR INSERT
  TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "cpp_update_members" ON public.client_portal_pulse FOR UPDATE
  TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- =========================================================================
-- 3. ENGAGEMENT SCORE FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.recalculate_client_engagement_score(_client_account_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _workspace_id uuid;
  _last_activity timestamptz;
  _last_login timestamptz;
  _completed_7d int := 0;
  _uploaded_14d int := 0;
  _comments_7d int := 0;
  _overdue_count int := 0;
  _pending_approvals int := 0;
  _score int := 50;
  _breakdown jsonb := '{}'::jsonb;
BEGIN
  SELECT workspace_id INTO _workspace_id FROM client_accounts WHERE id = _client_account_id;
  IF _workspace_id IS NULL THEN RETURN 0; END IF;

  SELECT MAX(created_at) INTO _last_activity FROM portal_activity_log WHERE client_account_id = _client_account_id;
  SELECT MAX(created_at) INTO _last_login FROM portal_activity_log WHERE client_account_id = _client_account_id AND activity_type = 'login';

  SELECT COUNT(*) INTO _completed_7d FROM portal_activity_log
    WHERE client_account_id = _client_account_id AND activity_type = 'task_complete' AND created_at > now() - interval '7 days';
  SELECT COUNT(*) INTO _uploaded_14d FROM portal_activity_log
    WHERE client_account_id = _client_account_id AND activity_type = 'doc_upload' AND created_at > now() - interval '14 days';
  SELECT COUNT(*) INTO _comments_7d FROM portal_activity_log
    WHERE client_account_id = _client_account_id AND activity_type IN ('task_comment','status_update') AND created_at > now() - interval '7 days';
  SELECT COUNT(*) INTO _pending_approvals FROM portal_activity_log
    WHERE client_account_id = _client_account_id AND requires_response = true AND responded_at IS NULL AND created_at < now() - interval '5 days';

  -- Positive signals
  IF _last_login IS NOT NULL AND _last_login > now() - interval '7 days' THEN _score := _score + 20; END IF;
  IF _completed_7d > 0 THEN _score := _score + 15; END IF;
  IF _uploaded_14d > 0 THEN _score := _score + 10; END IF;
  IF _comments_7d > 0 THEN _score := _score + 5; END IF;

  -- Negative signals
  IF _last_login IS NULL OR _last_login < now() - interval '14 days' THEN _score := _score - 20; END IF;
  IF _pending_approvals > 0 THEN _score := _score - LEAST(_pending_approvals * 10, 15); END IF;

  _score := GREATEST(0, LEAST(100, _score));

  _breakdown := jsonb_build_object(
    'last_login', _last_login,
    'completed_7d', _completed_7d,
    'uploaded_14d', _uploaded_14d,
    'comments_7d', _comments_7d,
    'pending_approvals', _pending_approvals
  );

  INSERT INTO client_portal_pulse (client_account_id, workspace_id, last_activity_at, last_login_at,
    tasks_completed_7d, docs_uploaded_7d, engagement_score, score_breakdown, updated_at)
  VALUES (_client_account_id, _workspace_id, _last_activity, _last_login,
    _completed_7d, _uploaded_14d, _score, _breakdown, now())
  ON CONFLICT (client_account_id) DO UPDATE SET
    last_activity_at = EXCLUDED.last_activity_at,
    last_login_at = EXCLUDED.last_login_at,
    tasks_completed_7d = EXCLUDED.tasks_completed_7d,
    docs_uploaded_7d = EXCLUDED.docs_uploaded_7d,
    engagement_score = EXCLUDED.engagement_score,
    score_breakdown = EXCLUDED.score_breakdown,
    updated_at = now();

  RETURN _score;
END;
$$;

-- Trigger: recalc pulse after each portal event
CREATE OR REPLACE FUNCTION public.trigger_recalc_pulse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_account_id IS NOT NULL THEN
    PERFORM public.recalculate_client_engagement_score(NEW.client_account_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pal_recalc_pulse ON public.portal_activity_log;
CREATE TRIGGER trg_pal_recalc_pulse
  AFTER INSERT ON public.portal_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_pulse();

-- Helper: mark seen
CREATE OR REPLACE FUNCTION public.mark_portal_event_seen(_event_id uuid, _user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE portal_activity_log
  SET seen_by_user_ids = (SELECT ARRAY(SELECT DISTINCT unnest(seen_by_user_ids || ARRAY[_user_id])))
  WHERE id = _event_id AND NOT (_user_id = ANY(seen_by_user_ids));
$$;

-- =========================================================================
-- 4. AI ARTIFACTS: extend with provenance + lifecycle fields
-- =========================================================================

ALTER TABLE public.ai_artifacts
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_pack jsonb,
  ADD COLUMN IF NOT EXISTS prompt_pack_hash text,
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS generation_cost numeric,
  ADD COLUMN IF NOT EXISTS content_raw text,
  ADD COLUMN IF NOT EXISTS content_edited text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_to_id uuid,
  ADD COLUMN IF NOT EXISTS applied_to_type text,
  ADD COLUMN IF NOT EXISTS ai_confidence_score numeric,
  ADD COLUMN IF NOT EXISTS human_edit_distance int,
  ADD COLUMN IF NOT EXISTS parent_artifact_id uuid REFERENCES public.ai_artifacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trigger_source text NOT NULL DEFAULT 'manual';

-- Expand kind + status constraints
ALTER TABLE public.ai_artifacts DROP CONSTRAINT IF EXISTS ai_artifacts_kind_check;
ALTER TABLE public.ai_artifacts ADD CONSTRAINT ai_artifacts_kind_check
  CHECK (kind = ANY (ARRAY[
    'draft','summary','risk','communication','other',
    'sow','project_plan','meeting_summary','risk_assessment',
    'email_draft','proposal','status_report','phase_kickoff','insight'
  ]));

ALTER TABLE public.ai_artifacts DROP CONSTRAINT IF EXISTS ai_artifacts_status_check;
ALTER TABLE public.ai_artifacts ADD CONSTRAINT ai_artifacts_status_check
  CHECK (status = ANY (ARRAY['draft','reviewed','approved','applied','discarded','archived']));

ALTER TABLE public.ai_artifacts ADD CONSTRAINT ai_artifacts_trigger_source_check
  CHECK (trigger_source = ANY (ARRAY['manual','event','scheduled']));

CREATE INDEX IF NOT EXISTS idx_ai_artifacts_status_inbox
  ON public.ai_artifacts(client_account_id, status, created_at DESC)
  WHERE status IN ('draft','reviewed');

-- =========================================================================
-- 5. TEMPLATE PHASES: AI bindings for on-enter / on-exit artifact generation
-- =========================================================================

ALTER TABLE public.template_phases
  ADD COLUMN IF NOT EXISTS ai_bindings jsonb NOT NULL DEFAULT '{"on_enter":[],"on_exit":[]}'::jsonb;
