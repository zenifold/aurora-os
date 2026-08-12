ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER TABLE public.deal_activities REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;