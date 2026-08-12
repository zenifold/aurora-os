-- Department on account-contact link
ALTER TABLE public.client_account_contacts
  ADD COLUMN IF NOT EXISTS department text;

-- Deal-level contacts (separate roster from account-level)
CREATE TABLE IF NOT EXISTS public.deal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'other'
    CHECK (role IN ('champion','decision_maker','influencer','end_user','blocker','legal','finance','technical','other')),
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, contact_id)
);

CREATE INDEX IF NOT EXISTS deal_contacts_deal_idx ON public.deal_contacts(deal_id);
CREATE INDEX IF NOT EXISTS deal_contacts_contact_idx ON public.deal_contacts(contact_id);

ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members rw deal_contacts"
  ON public.deal_contacts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_contacts.deal_id
        AND public.is_workspace_member(auth.uid(), d.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_contacts.deal_id
        AND public.is_workspace_member(auth.uid(), d.workspace_id)
    )
  );
