-- Racik — the signed-in user's personal library, so it survives a lost phone.
--
-- Why one jsonb blob rather than tables per list:
--
--  * The library (saved ids, imported recipes, this-week plan, servings,
--    ratings, cook log) is read and written only by its owner, all at once,
--    on the device. It is never queried across users or joined. A single row
--    the client reads on sign-in and writes on change is the whole need.
--  * The client merges by union (nothing is ever dropped on sync), so there is
--    no server-side reconciliation to model in SQL.
--  * Photos the cook took stay on the device — they are large and personal and
--    do not belong in this row.
--
-- Row Level Security carries the rule: a user touches only their own row.

create table if not exists public.user_library (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_library enable row level security;

create policy "you read your own library" on public.user_library
  for select using (user_id = auth.uid());
create policy "you create your own library" on public.user_library
  for insert with check (user_id = auth.uid());
create policy "you update your own library" on public.user_library
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
