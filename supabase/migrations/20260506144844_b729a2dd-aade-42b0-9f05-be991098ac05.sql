ALTER TABLE public.pages REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pages';
  END IF;
END $$;