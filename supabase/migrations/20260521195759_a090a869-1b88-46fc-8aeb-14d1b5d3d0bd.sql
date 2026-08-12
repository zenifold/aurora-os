-- Block creating a new workspace when the owner's email domain
-- is already claimed by another workspace via auto_join_domains.
CREATE OR REPLACE FUNCTION public.enforce_email_domain_workspace_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_email text;
  domain text;
  claiming_ws_id uuid;
  claiming_ws_name text;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email INTO owner_email FROM auth.users WHERE id = NEW.owner_id;
  IF owner_email IS NULL OR position('@' in owner_email) = 0 THEN
    RETURN NEW;
  END IF;

  domain := lower(split_part(owner_email, '@', 2));

  IF domain IN (
    'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
    'proton.me','protonmail.com','aol.com','live.com','me.com','msn.com'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id, name INTO claiming_ws_id, claiming_ws_name
  FROM public.workspaces
  WHERE domain = ANY (auto_join_domains)
    AND id IS DISTINCT FROM NEW.id
  ORDER BY created_at ASC
  LIMIT 1;

  IF claiming_ws_id IS NOT NULL THEN
    RAISE EXCEPTION 'EMAIL_DOMAIN_CLAIMED:%:%', claiming_ws_id, claiming_ws_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_email_domain_workspace_claim_trigger ON public.workspaces;
CREATE TRIGGER enforce_email_domain_workspace_claim_trigger
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_email_domain_workspace_claim();