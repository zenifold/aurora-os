-- Enable realtime for core workspace tables
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.folders REPLICA IDENTITY FULL;
ALTER TABLE public.divisions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.divisions;