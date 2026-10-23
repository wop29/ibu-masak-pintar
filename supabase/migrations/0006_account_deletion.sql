-- Racik — account deletion (Google Play "delete account" + UU PDP right to erasure).
--
-- Run in the Supabase SQL editor (it runs as `postgres`). Safe to run more
-- than once.
--
-- How deletion works end to end:
--   1. The app deletes her photos in storage (resep/<uid>/...) with the
--      Storage API. Supabase blocks deleting storage.objects rows from SQL,
--      so that part cannot live in this function.
--   2. The app calls delete_my_account(). It removes her rows everywhere and
--      finally the auth user. It only ever acts on auth.uid(): nobody can
--      delete anyone else.
--
-- missing_ingredients (0005) holds no user link, so there is nothing of hers there.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- Each table is checked first, so this keeps working if one is renamed or
  -- not created yet. Most rows would also go by cascade from auth.users; the
  -- explicit deletes make the order (and the intent) obvious.
  if to_regclass('public.reports') is not null then
    delete from public.reports where reporter_id = uid or subject_id = uid;
  end if;
  if to_regclass('public.blocks') is not null then
    delete from public.blocks where blocker_id = uid or blocked_id = uid;
  end if;
  if to_regclass('public.recipes') is not null then
    -- reports pointing at her recipes go with them (on delete cascade)
    delete from public.recipes where author_id = uid;
  end if;
  if to_regclass('public.user_library') is not null then
    delete from public.user_library where user_id = uid;
  end if;
  if to_regclass('public.moderators') is not null then
    delete from public.moderators where user_id = uid;
  end if;
  if to_regclass('public.profiles') is not null then
    delete from public.profiles where id = uid;
  end if;

  -- Last: the login itself. Anything else that references auth.users
  -- "on delete cascade" (tables added by later migrations) goes with it.
  delete from auth.users where id = uid;
end;
$$;

-- Owned by postgres so the function may delete from auth.users.
alter function public.delete_my_account() owner to postgres;
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- She can delete her own library row (also used by a future "reset sync").
drop policy if exists "you delete your own library" on public.user_library;
create policy "you delete your own library" on public.user_library
  for delete using (user_id = auth.uid());

-- She can list her own photo folder, so the app can delete every photo before
-- the account goes — even if the bucket-wide "recipe photos are public" select
-- policy is later dropped (audit: storage objects publicly listable).
drop policy if exists "you list your own photos" on storage.objects;
create policy "you list your own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'resep' and (storage.foldername(name))[1] = auth.uid()::text);
