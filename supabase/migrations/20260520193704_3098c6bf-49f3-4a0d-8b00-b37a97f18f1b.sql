
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN CREATE TYPE public.client_account_status AS ENUM ('prospect','active','paused','churned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.client_account_tier AS ENUM ('standard','premium','strategic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.client_account_health AS ENUM ('green','yellow','red','unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.onboarding_stage AS ENUM ('kickoff_pending','intake','setup','handover','active','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.onboarding_step_status AS ENUM ('pending','in_progress','complete','skipped','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.handover_status AS ENUM ('draft','sent','accepted','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.handover_team AS ENUM ('sales','delivery','ops','support','finance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.template_category AS ENUM ('web_build','retainer','consulting','implementation','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.template_item_kind AS ENUM ('milestone','task','raid','doc_folder','channel','meeting','automation','intake_form','role_slot'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  legal_name text, industry text, size text, website text,
  primary_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  account_owner_id uuid, billing_email text,
  address jsonb DEFAULT '{}'::jsonb,
  tier public.client_account_tier NOT NULL DEFAULT 'standard',
  health public.client_account_health NOT NULL DEFAULT 'unknown',
  status public.client_account_status NOT NULL DEFAULT 'prospect',
  notes text, tags text[] DEFAULT '{}', metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_accounts_workspace ON public.client_accounts(workspace_id);

CREATE TABLE IF NOT EXISTS public.client_account_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'day_to_day',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_account_id, contact_id, role)
);

CREATE TABLE IF NOT EXISTS public.project_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  name text NOT NULL, description text,
  category public.template_category NOT NULL DEFAULT 'custom',
  default_duration_days integer DEFAULT 30,
  default_team_shape jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_templates_workspace ON public.project_templates(workspace_id);

CREATE TABLE IF NOT EXISTS public.project_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
  kind public.template_item_kind NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  parent_item_id uuid REFERENCES public.project_template_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_template_items_template ON public.project_template_items(template_id, order_index);

CREATE TABLE IF NOT EXISTS public.onboardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_account_id uuid NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.project_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage public.onboarding_stage NOT NULL DEFAULT 'kickoff_pending',
  owner_id uuid, target_go_live date,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  progress integer NOT NULL DEFAULT 0,
  notes text, metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboardings_workspace ON public.onboardings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_onboardings_account ON public.onboardings(client_account_id);

CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.onboardings(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  title text NOT NULL,
  description text,
  owner_role text, owner_user_id uuid,
  status public.onboarding_step_status NOT NULL DEFAULT 'pending',
  is_blocking boolean NOT NULL DEFAULT false,
  due_at timestamptz,
  completed_by uuid, completed_at timestamptz,
  artifact_url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_onb ON public.onboarding_steps(onboarding_id, order_index);

CREATE TABLE IF NOT EXISTS public.handover_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  onboarding_id uuid REFERENCES public.onboardings(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  from_team public.handover_team NOT NULL,
  to_team public.handover_team NOT NULL,
  status public.handover_status NOT NULL DEFAULT 'draft',
  summary text, scope text, risks text,
  stakeholders jsonb DEFAULT '[]'::jsonb,
  artifacts jsonb DEFAULT '[]'::jsonb,
  submitted_by uuid, submitted_at timestamptz,
  accepted_by uuid, accepted_at timestamptz,
  rejected_by uuid, rejected_at timestamptz,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_handover_workspace ON public.handover_packets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_handover_onboarding ON public.handover_packets(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_handover_project ON public.handover_packets(project_id);

CREATE TABLE IF NOT EXISTS public.handover_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.handover_packets(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  is_complete boolean NOT NULL DEFAULT false,
  artifact_url text, notes text,
  order_index integer NOT NULL DEFAULT 0,
  completed_by uuid, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.project_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_id uuid REFERENCES public.onboardings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_client_account ON public.projects(client_account_id);

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_client_account ON public.deals(client_account_id);

DROP TRIGGER IF EXISTS trg_client_accounts_updated_at ON public.client_accounts;
CREATE TRIGGER trg_client_accounts_updated_at BEFORE UPDATE ON public.client_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_project_templates_updated_at ON public.project_templates;
CREATE TRIGGER trg_project_templates_updated_at BEFORE UPDATE ON public.project_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_onboardings_updated_at ON public.onboardings;
CREATE TRIGGER trg_onboardings_updated_at BEFORE UPDATE ON public.onboardings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_onboarding_steps_updated_at ON public.onboarding_steps;
CREATE TRIGGER trg_onboarding_steps_updated_at BEFORE UPDATE ON public.onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_handover_packets_updated_at ON public.handover_packets;
CREATE TRIGGER trg_handover_packets_updated_at BEFORE UPDATE ON public.handover_packets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_account_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read client_accounts" ON public.client_accounts;
CREATE POLICY "members read client_accounts" ON public.client_accounts FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members insert client_accounts" ON public.client_accounts;
CREATE POLICY "members insert client_accounts" ON public.client_accounts FOR INSERT WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members update client_accounts" ON public.client_accounts;
CREATE POLICY "members update client_accounts" ON public.client_accounts FOR UPDATE USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members delete client_accounts" ON public.client_accounts;
CREATE POLICY "members delete client_accounts" ON public.client_accounts FOR DELETE USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "members rw client_account_contacts" ON public.client_account_contacts;
CREATE POLICY "members rw client_account_contacts" ON public.client_account_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_account_id AND public.is_workspace_member(auth.uid(), ca.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.id = client_account_id AND public.is_workspace_member(auth.uid(), ca.workspace_id)));

DROP POLICY IF EXISTS "members read project_templates" ON public.project_templates;
CREATE POLICY "members read project_templates" ON public.project_templates FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members insert project_templates" ON public.project_templates;
CREATE POLICY "members insert project_templates" ON public.project_templates FOR INSERT WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members update project_templates" ON public.project_templates;
CREATE POLICY "members update project_templates" ON public.project_templates FOR UPDATE USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members delete project_templates" ON public.project_templates;
CREATE POLICY "members delete project_templates" ON public.project_templates FOR DELETE USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "members rw template_items" ON public.project_template_items;
CREATE POLICY "members rw template_items" ON public.project_template_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.project_templates t WHERE t.id = template_id AND public.is_workspace_member(auth.uid(), t.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_templates t WHERE t.id = template_id AND public.is_workspace_member(auth.uid(), t.workspace_id)));

DROP POLICY IF EXISTS "members read onboardings" ON public.onboardings;
CREATE POLICY "members read onboardings" ON public.onboardings FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members insert onboardings" ON public.onboardings;
CREATE POLICY "members insert onboardings" ON public.onboardings FOR INSERT WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members update onboardings" ON public.onboardings;
CREATE POLICY "members update onboardings" ON public.onboardings FOR UPDATE USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members delete onboardings" ON public.onboardings;
CREATE POLICY "members delete onboardings" ON public.onboardings FOR DELETE USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "members rw onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "members rw onboarding_steps" ON public.onboarding_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.onboardings o WHERE o.id = onboarding_id AND public.is_workspace_member(auth.uid(), o.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.onboardings o WHERE o.id = onboarding_id AND public.is_workspace_member(auth.uid(), o.workspace_id)));

DROP POLICY IF EXISTS "members read handover_packets" ON public.handover_packets;
CREATE POLICY "members read handover_packets" ON public.handover_packets FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members insert handover_packets" ON public.handover_packets;
CREATE POLICY "members insert handover_packets" ON public.handover_packets FOR INSERT WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members update handover_packets" ON public.handover_packets;
CREATE POLICY "members update handover_packets" ON public.handover_packets FOR UPDATE USING (public.is_workspace_member(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "members delete handover_packets" ON public.handover_packets;
CREATE POLICY "members delete handover_packets" ON public.handover_packets FOR DELETE USING (public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "members rw handover_checklist_items" ON public.handover_checklist_items;
CREATE POLICY "members rw handover_checklist_items" ON public.handover_checklist_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.handover_packets p WHERE p.id = packet_id AND public.is_workspace_member(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.handover_packets p WHERE p.id = packet_id AND public.is_workspace_member(auth.uid(), p.workspace_id)));
