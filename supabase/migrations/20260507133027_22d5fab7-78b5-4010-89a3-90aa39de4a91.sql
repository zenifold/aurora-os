-- Improve global_search: add scoping, recency boost, comments, meeting transcripts
CREATE OR REPLACE FUNCTION public.global_search(
  _workspace_id uuid,
  _q text,
  _limit integer DEFAULT 30,
  _project_id uuid DEFAULT NULL
)
RETURNS TABLE(kind text, id uuid, title text, snippet text, project_id uuid, rank real)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Tasks: text similarity + recency boost (0..0.3 over last 60 days)
    SELECT 'task'::text, t.id, t.title, left(coalesce(t.description,''), 200), t.project_id,
           (similarity(t.title, _q)
            + greatest(0, 0.3 - extract(epoch from (now() - t.updated_at)) / (60*60*24*60) * 0.3))::real AS rank
    FROM public.tasks t
    WHERE t.workspace_id = _workspace_id
      AND (_project_id IS NULL OR t.project_id = _project_id)
      AND (t.title ILIKE needle OR coalesce(t.description,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'project'::text, p.id, p.name, left(coalesce(p.description,''), 200), p.id,
           (similarity(p.name, _q)
            + greatest(0, 0.2 - extract(epoch from (now() - p.updated_at)) / (60*60*24*90) * 0.2))::real
    FROM public.projects p
    WHERE p.workspace_id = _workspace_id
      AND (_project_id IS NULL OR p.id = _project_id)
      AND (p.name ILIKE needle OR coalesce(p.description,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'note'::text, n.id, coalesce(n.title,'Untitled'), left(coalesce(n.content,''), 200), n.project_id,
           (greatest(similarity(coalesce(n.title,''), _q), similarity(left(coalesce(n.content,''), 500), _q) * 0.7)
            + greatest(0, 0.2 - extract(epoch from (now() - n.updated_at)) / (60*60*24*60) * 0.2))::real
    FROM public.notes n
    WHERE n.workspace_id = _workspace_id
      AND (_project_id IS NULL OR n.project_id = _project_id)
      AND (coalesce(n.title,'') ILIKE needle OR coalesce(n.content,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    SELECT 'page'::text, pg.id, pg.title, left(pg.content_text, 200), pg.project_id,
           (ts_rank(to_tsvector('english', coalesce(pg.title,'') || ' ' || coalesce(pg.content_text,'')), plainto_tsquery('english', _q))
            + greatest(0, 0.15 - extract(epoch from (now() - pg.updated_at)) / (60*60*24*60) * 0.15))::real
    FROM public.pages pg
    WHERE pg.workspace_id = _workspace_id
      AND pg.is_archived = false
      AND (_project_id IS NULL OR pg.project_id = _project_id)
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
      AND _project_id IS NULL
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
      AND _project_id IS NULL
      AND (c.name ILIKE needle OR coalesce(c.company,'') ILIKE needle OR coalesce(c.email,'') ILIKE needle)
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    -- Comments: surface the parent task with the comment snippet
    SELECT 'comment'::text, cm.task_id, coalesce(t.title, 'Comment'),
           left(cm.body, 200), t.project_id,
           (similarity(left(cm.body, 500), _q)
            + greatest(0, 0.2 - extract(epoch from (now() - cm.created_at)) / (60*60*24*30) * 0.2))::real
    FROM public.comments cm
    JOIN public.tasks t ON t.id = cm.task_id
    WHERE cm.workspace_id = _workspace_id
      AND (_project_id IS NULL OR t.project_id = _project_id)
      AND cm.body ILIKE needle
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  )
  UNION ALL
  (
    -- Meetings: search title + transcript
    SELECT 'meeting'::text, m.id, coalesce(m.title, 'Meeting'),
           left(coalesce(m.transcript, m.summary, ''), 200), m.project_id,
           (greatest(
              similarity(coalesce(m.title,''), _q),
              similarity(left(coalesce(m.transcript,''), 1000), _q) * 0.6,
              similarity(coalesce(m.summary,''), _q) * 0.8
            )
            + greatest(0, 0.2 - extract(epoch from (now() - coalesce(m.updated_at, m.created_at))) / (60*60*24*60) * 0.2))::real
    FROM public.meetings m
    WHERE m.workspace_id = _workspace_id
      AND (_project_id IS NULL OR m.project_id = _project_id)
      AND (
        coalesce(m.title,'') ILIKE needle
        OR coalesce(m.summary,'') ILIKE needle
        OR coalesce(m.transcript,'') ILIKE needle
      )
    ORDER BY rank DESC NULLS LAST
    LIMIT _limit
  );
END;
$function$;