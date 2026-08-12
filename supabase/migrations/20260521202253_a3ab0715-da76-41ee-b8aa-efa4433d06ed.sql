-- Centralized personal/free email domain blocklist.
-- Used by triggers and RPCs so personal-email users never auto-join or claim a workspace domain.
CREATE OR REPLACE FUNCTION public.is_personal_email_domain(_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(_domain, '')) = ANY (ARRAY[
    -- Google
    'gmail.com','googlemail.com',
    -- Microsoft
    'outlook.com','hotmail.com','live.com','msn.com','outlook.co.uk','hotmail.co.uk','live.co.uk','hotmail.fr','live.fr','outlook.fr','hotmail.de','live.de','outlook.de','hotmail.it','live.it','outlook.it','hotmail.es','live.es','outlook.es',
    -- Apple
    'icloud.com','me.com','mac.com',
    -- Yahoo / AOL / Verizon
    'yahoo.com','yahoo.co.uk','yahoo.fr','yahoo.de','yahoo.it','yahoo.es','yahoo.co.in','yahoo.com.br','yahoo.com.mx','yahoo.ca','yahoo.com.au','ymail.com','rocketmail.com','aol.com','aim.com',
    -- Proton / Tutanota / privacy
    'proton.me','protonmail.com','pm.me','tutanota.com','tutanota.de','tuta.io','tutamail.com','mailbox.org','posteo.de','posteo.net','hey.com','fastmail.com','fastmail.fm',
    -- GMX / Web.de / T-Online
    'gmx.com','gmx.net','gmx.de','gmx.us','gmx.co.uk','gmx.fr','web.de','t-online.de','freenet.de',
    -- Yandex / Mail.ru
    'yandex.com','yandex.ru','ya.ru','mail.ru','bk.ru','inbox.ru','list.ru','internet.ru',
    -- Asia
    'qq.com','163.com','126.com','sina.com','sina.cn','sohu.com','foxmail.com','aliyun.com','naver.com','daum.net','hanmail.net','rediffmail.com',
    -- Other ISPs / freemail
    'zoho.com','zohomail.com','yopmail.com','ymail.com','seznam.cz','wp.pl','onet.pl','o2.pl','interia.pl','libero.it','virgilio.it','tin.it','laposte.net','orange.fr','wanadoo.fr','free.fr','sfr.fr','bbox.fr','neuf.fr','sky.com','btinternet.com','ntlworld.com','virginmedia.com','blueyonder.co.uk','talktalk.net','tiscali.co.uk','bigpond.com','bigpond.net.au','optusnet.com.au','xtra.co.nz',
    -- Disposable / temp mail
    'mailinator.com','guerrillamail.com','10minutemail.com','temp-mail.org','sharklasers.com','trashmail.com','throwawaymail.com','dispostable.com','maildrop.cc','getnada.com','tempmail.com','mintemail.com','mohmal.com','spambox.us'
  ]);
$$;

GRANT EXECUTE ON FUNCTION public.is_personal_email_domain(text) TO authenticated, anon;

-- Update lookup RPC to use the centralized blocklist
CREATE OR REPLACE FUNCTION public.find_workspace_for_email(_email text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  matched_domain text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  domain text;
BEGIN
  IF _email IS NULL OR position('@' in _email) = 0 THEN
    RETURN;
  END IF;
  domain := lower(split_part(_email, '@', 2));
  IF public.is_personal_email_domain(domain) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT w.id, w.name, w.slug, w.logo_url, domain
    FROM public.workspaces w
    WHERE domain = ANY (w.auto_join_domains)
    ORDER BY w.created_at ASC
    LIMIT 1;
END;
$$;

-- Enforce in join RPC too: refuse to auto-join personal-email users
CREATE OR REPLACE FUNCTION public.join_workspace_by_email_domain(_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  domain text;
  ws_domains text[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  IF user_email IS NULL OR position('@' in user_email) = 0 THEN
    RAISE EXCEPTION 'no email on account';
  END IF;
  domain := lower(split_part(user_email, '@', 2));

  IF public.is_personal_email_domain(domain) THEN
    RAISE EXCEPTION 'personal email domains cannot auto-join workspaces';
  END IF;

  SELECT auto_join_domains INTO ws_domains
  FROM public.workspaces WHERE id = _workspace_id;
  IF ws_domains IS NULL OR NOT (domain = ANY (ws_domains)) THEN
    RAISE EXCEPTION 'email domain not allowed for this workspace';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id)
  VALUES (_workspace_id, uid)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (workspace_id, user_id, role)
  VALUES (_workspace_id, uid, 'member')
  ON CONFLICT DO NOTHING;

  RETURN _workspace_id;
END;
$$;

-- Strip personal domains from auto_join_domains on write, so they can never be claimed.
CREATE OR REPLACE FUNCTION public.sanitize_auto_join_domains()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cleaned text[];
BEGIN
  IF NEW.auto_join_domains IS NULL THEN
    NEW.auto_join_domains := '{}';
    RETURN NEW;
  END IF;
  SELECT COALESCE(array_agg(DISTINCT lower(d)), '{}')
  INTO cleaned
  FROM unnest(NEW.auto_join_domains) AS d
  WHERE d IS NOT NULL
    AND length(trim(d)) > 0
    AND NOT public.is_personal_email_domain(lower(d));
  NEW.auto_join_domains := cleaned;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_auto_join_domains_trigger ON public.workspaces;
CREATE TRIGGER sanitize_auto_join_domains_trigger
  BEFORE INSERT OR UPDATE OF auto_join_domains ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_auto_join_domains();

-- Backfill: scrub any personal domains that were saved before this change.
UPDATE public.workspaces
SET auto_join_domains = (
  SELECT COALESCE(array_agg(DISTINCT lower(d)), '{}')
  FROM unnest(auto_join_domains) AS d
  WHERE NOT public.is_personal_email_domain(lower(d))
)
WHERE EXISTS (
  SELECT 1 FROM unnest(auto_join_domains) AS d
  WHERE public.is_personal_email_domain(lower(d))
);