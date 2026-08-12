ALTER TABLE public.ai_automations
  ALTER COLUMN agent_id DROP NOT NULL;

ALTER TABLE public.ai_automations
  ADD COLUMN IF NOT EXISTS action_config jsonb NOT NULL DEFAULT '{}'::jsonb;