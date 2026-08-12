alter table public.meetings add column if not exists audio_path text;

insert into storage.buckets (id, name, public) values ('meeting-recordings','meeting-recordings', false)
on conflict (id) do nothing;

create policy "Workspace members read meeting recordings"
on storage.objects for select to authenticated
using (
  bucket_id = 'meeting-recordings'
  and public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

create policy "Workspace members upload meeting recordings"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'meeting-recordings'
  and public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

create policy "Workspace members delete meeting recordings"
on storage.objects for delete to authenticated
using (
  bucket_id = 'meeting-recordings'
  and public.is_workspace_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);