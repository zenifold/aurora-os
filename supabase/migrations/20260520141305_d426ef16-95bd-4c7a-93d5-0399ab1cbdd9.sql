
CREATE TABLE public.intake_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  visibility TEXT NOT NULL DEFAULT 'client' CHECK (visibility IN ('client','internal','both')),
  allow_anonymous BOOLEAN NOT NULL DEFAULT false,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_intake_forms_project ON public.intake_forms(project_id);
CREATE INDEX idx_intake_forms_workspace ON public.intake_forms(workspace_id);

ALTER TABLE public.intake_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage intake forms"
ON public.intake_forms FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER trg_intake_forms_updated
BEFORE UPDATE ON public.intake_forms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.intake_form_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.intake_forms(id) ON DELETE CASCADE,
  client_portal_access_id UUID REFERENCES public.client_portal_access(id) ON DELETE SET NULL,
  respondent_name TEXT,
  respondent_email TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_intake_responses_form ON public.intake_form_responses(form_id);
CREATE INDEX idx_intake_responses_project ON public.intake_form_responses(project_id);

ALTER TABLE public.intake_form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage intake responses"
ON public.intake_form_responses FOR ALL
USING (public.is_workspace_member(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER trg_intake_responses_updated
BEFORE UPDATE ON public.intake_form_responses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
