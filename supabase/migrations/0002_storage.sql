-- Photo storage for user-posted recipes.
--
-- Public read, because a shared recipe link has to render for someone who has
-- never opened Racik. Writes are confined to a folder named after the author's
-- own user id, so nobody can overwrite anyone else's photograph.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resep', 'resep', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy "recipe photos are public" on storage.objects
  for select using (bucket_id = 'resep');

create policy "you upload into your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resep' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "you replace your own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'resep' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "you delete your own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resep' and (storage.foldername(name))[1] = auth.uid()::text);
