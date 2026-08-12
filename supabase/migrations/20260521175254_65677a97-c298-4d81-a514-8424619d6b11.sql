
-- Phase 1: bridge client_accounts <-> folders so we can collapse them later.

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS client_account_id uuid
    REFERENCES public.client_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.client_accounts
  ADD COLUMN IF NOT EXISTS default_folder_id uuid
    REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS folders_client_account_idx
  ON public.folders(client_account_id)
  WHERE client_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_accounts_default_folder_idx
  ON public.client_accounts(default_folder_id)
  WHERE default_folder_id IS NOT NULL;

-- Backfill: match by (workspace_id, lower(trim(name))) where exactly one
-- candidate exists on each side. Prefer client-typed folders.
WITH pairs AS (
  SELECT
    ca.id AS account_id,
    f.id  AS folder_id,
    ROW_NUMBER() OVER (
      PARTITION BY ca.id
      ORDER BY (f.folder_type = 'client') DESC, f.created_at ASC
    ) AS acc_rank,
    ROW_NUMBER() OVER (
      PARTITION BY f.id
      ORDER BY ca.created_at ASC
    ) AS fol_rank
  FROM public.client_accounts ca
  JOIN public.folders f
    ON f.workspace_id = ca.workspace_id
   AND lower(trim(f.name)) = lower(trim(ca.name))
  WHERE f.client_account_id IS NULL
    AND ca.default_folder_id IS NULL
)
UPDATE public.folders f
SET client_account_id = p.account_id
FROM pairs p
WHERE f.id = p.folder_id
  AND p.acc_rank = 1
  AND p.fol_rank = 1;

UPDATE public.client_accounts ca
SET default_folder_id = f.id
FROM public.folders f
WHERE f.client_account_id = ca.id
  AND ca.default_folder_id IS NULL;
