
CREATE OR REPLACE FUNCTION public.global_search(_workspace_id uuid, _q text, _limit int DEFAULT 30)
RETURNS TABLE (
  kind text,
  id uuid,
  title text,
  snippet text,
  project_id uuid,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needle text := '%' || coalesce(_q, '') || '%';
BEGIN
  IF NOT public.is_workspace_member(auth.uid(), _workspace_id) THEN
    RETURN;
  END IF;
  IF coalesce(_q, '') = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  (
    SELECT 'task'::text, t.id, t.title, left(coalesce(t.description,''), 200), t.project_id,
           similarity(t.title, _q)::real AS rank
    FROM public.tasks t
    WHERE t.workspace_id = _workspace_id
      AND (t.title ILIKE needle OR coalesce(t.description,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'project'::text, p.id, p.name, left(coalesce(p.description,''), 200), p.id,
           similarity(p.name, _q)::real
    FROM public.projects p
    WHERE p.workspace_id = _workspace_id
      AND (p.name ILIKE needle OR coalesce(p.description,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'note'::text, n.id, coalesce(n.title,'Untitled'), '', n.project_id,
           similarity(coalesce(n.title,''), _q)::real
    FROM public.notes n
    WHERE n.workspace_id = _workspace_id
      AND coalesce(n.title,'') ILIKE needle
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'page'::text, pg.id, pg.title, left(pg.content_text, 200), null::uuid,
           ts_rank(to_tsvector('english', coalesce(pg.title,'') || ' ' || coalesce(pg.content_text,'')), plainto_tsquery('english', _q))::real
    FROM public.pages pg
    WHERE pg.workspace_id = _workspace_id
      AND pg.is_archived = false
      AND to_tsvector('english', coalesce(pg.title,'') || ' ' || coalesce(pg.content_text,''))
          @@ plainto_tsquery('english', _q)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'folder'::text, f.id, f.name, left(coalesce(f.description,''), 200), null::uuid,
           similarity(f.name, _q)::real
    FROM public.folders f
    WHERE f.workspace_id = _workspace_id
      AND f.is_archived = false
      AND (f.name ILIKE needle OR coalesce(f.description,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'contact'::text, c.id, c.name, coalesce(c.company, c.email, ''), null::uuid,
           similarity(c.name, _q)::real
    FROM public.contacts c
    WHERE c.workspace_id = _workspace_id
      AND (c.name ILIKE needle OR coalesce(c.company,'') ILIKE needle OR coalesce(c.email,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_search(uuid, text, int) TO authenticated;
