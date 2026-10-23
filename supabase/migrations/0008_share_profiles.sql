-- Racik 0008 — share cards, public profiles, link stats, and the RLS fixes
-- from audit P1-4.
--
-- Safe to run more than once: every object is created "if not exists" or
-- replaced, and every policy is dropped before it is created again.
--
-- What this migration changes, in plain words:
--
--  1. Profiles stop being a public list. Before, anyone holding the
--     publishable key could read every row of `profiles` (real names
--     included). Now you read only your own row. Strangers see a profile
--     only through `profile_by_handle()` (one handle at a time, and only
--     people who chose a handle) or `author_cards()` (only authors with a
--     published recipe). Neither ever returns the private `name`.
--  2. Users can no longer write moderation columns. `suspended`, a recipe's
--     `status`, `hidden_reason`, `published_at`, `cooked_count` and
--     `saved_count` are not writable by the app at all; publishing goes
--     through `publish_recipe()`, which refuses hidden or removed recipes and
--     stamps the date itself. Counts move only through `record_link_event()`.
--  3. Share links (racik.online/r/<code>), open counting and save/cook
--     attribution, each written only through SECURITY DEFINER functions with
--     dedupe and rate limits, and readable only by the link's owner.

-- ===================================================================
-- 1. New columns
-- ===================================================================

-- A public handle is the opt-in: no handle, no public profile.
alter table public.profiles add column if not exists handle text;
-- Shown under the handle only when she fills it in. `name` stays private.
alter table public.profiles add column if not exists public_name text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_handle_format') then
    alter table public.profiles add constraint profiles_handle_format
      check (handle is null or (handle ~ '^[a-z0-9_.]{3,24}$'
        and handle not in ('racik', 'admin', 'moderator', 'support', 'official', 'resmi', 'tim', 'cs')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_public_name_len') then
    alter table public.profiles add constraint profiles_public_name_len
      check (public_name is null or length(trim(public_name)) between 2 and 40);
  end if;
end $$;

create unique index if not exists profiles_handle_key on public.profiles (handle) where handle is not null;

-- Cooking time, and where an adapted recipe came from (credited, never claimed).
alter table public.recipes add column if not exists time_min int;
alter table public.recipes add column if not exists source_creator text;
alter table public.recipes add column if not exists source_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_time_min_range') then
    alter table public.recipes add constraint recipes_time_min_range
      check (time_min is null or time_min between 1 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recipes_source_len') then
    alter table public.recipes add constraint recipes_source_len
      check (coalesce(length(source_creator), 0) <= 60 and coalesce(length(source_url), 0) <= 300);
  end if;
end $$;

-- ===================================================================
-- 2. Helpers
-- ===================================================================

-- RLS policies run as the reader, who can no longer read other profiles, so
-- the "is the author suspended" check has to run with owner rights.
create or replace function public.is_suspended(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = uid), false);
$$;

-- ===================================================================
-- 3. Profiles: own row only, and only harmless columns writable
-- ===================================================================

drop policy if exists "profiles are public" on public.profiles;
drop policy if exists "you read your own profile" on public.profiles;
create policy "you read your own profile" on public.profiles
  for select using (id = auth.uid() or public.is_moderator());

drop policy if exists "you edit your own profile" on public.profiles;
create policy "you edit your own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "you create your own profile" on public.profiles;
create policy "you create your own profile" on public.profiles
  for insert with check (id = auth.uid());

-- Column grants are what stop `update profiles set suspended = false`.
-- `id` is listed because supabase-js upsert writes every column it sends; the
-- policy above still pins it to auth.uid().
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, photo_path, handle, public_name) on public.profiles to authenticated;
grant update (id, name, photo_path, handle, public_name) on public.profiles to authenticated;

-- Belt and braces in case a later migration re-grants the whole table.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.suspended := false;
    else
      new.suspended := old.suspended;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- ===================================================================
-- 4. Recipes: content editable, moderation and counters are not
-- ===================================================================

drop policy if exists "live recipes are public" on public.recipes;
create policy "live recipes are public" on public.recipes
  for select using (
    (status = 'live'
      and not public.is_suspended(author_id)
      and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = author_id))
    or author_id = auth.uid()
    or public.is_moderator()
  );

drop policy if exists "you post as yourself" on public.recipes;
create policy "you post as yourself" on public.recipes
  for insert with check (author_id = auth.uid() and not public.is_suspended(auth.uid()));

-- `status` is no longer writable by the app, so a hidden recipe stays hidden
-- whatever the author sends. Editing a removed recipe is refused outright.
drop policy if exists "you edit your own recipes" on public.recipes;
create policy "you edit your own recipes" on public.recipes
  for update using (author_id = auth.uid() and status <> 'removed')
  with check (author_id = auth.uid());

drop policy if exists "you delete your own recipes" on public.recipes;
create policy "you delete your own recipes" on public.recipes
  for delete using (author_id = auth.uid());

-- Moderators act through moderate_recipe() below; a direct update policy
-- would be blocked by the column grants anyway.
drop policy if exists "moderators may act on any recipe" on public.recipes;

revoke insert, update, delete on public.recipes from anon, authenticated;
grant select, delete on public.recipes to authenticated;
grant select on public.recipes to anon;
grant insert (id, author_id, title, serv, note, region, photo_path, ings, steps, time_min, source_creator, source_url)
  on public.recipes to authenticated;
grant update (id, author_id, title, serv, note, region, photo_path, ings, steps, time_min, source_creator, source_url)
  on public.recipes to authenticated;

-- A new row always starts as an unpublished draft with zero counts, and an
-- update from the app can never move the moderation or counter columns.
create or replace function public.recipes_guard() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.status := 'draft';
      new.published_at := null;
      new.hidden_reason := null;
      new.cooked_count := 0;
      new.saved_count := 0;
      new.created_at := now();
    else
      new.status := old.status;
      new.published_at := old.published_at;
      new.hidden_reason := old.hidden_reason;
      new.cooked_count := old.cooked_count;
      new.saved_count := old.saved_count;
      new.created_at := old.created_at;
      new.author_id := old.author_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists recipes_guard on public.recipes;
create trigger recipes_guard before insert or update on public.recipes
  for each row execute function public.recipes_guard();

-- Publishing: only your own, only a draft or already-live recipe, only when
-- you are not suspended and have a public handle. The date is the server's.
create or replace function public.publish_recipe(recipe_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r public.recipes;
begin
  select * into r from public.recipes where id = recipe_id;
  if r.id is null or r.author_id <> auth.uid() then return 'not_found'; end if;
  if r.status in ('hidden', 'removed') then return 'hidden'; end if;
  if public.is_suspended(auth.uid()) then return 'suspended'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and handle is not null) then
    return 'no_handle';
  end if;
  if r.status = 'live' then return 'ok'; end if;
  update public.recipes set status = 'live', published_at = now() where id = recipe_id;
  return 'ok';
end $$;

create or replace function public.unpublish_recipe(recipe_id uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.recipes set status = 'draft'
    where id = recipe_id and author_id = auth.uid() and status = 'live';
  return 'ok';
end $$;

create or replace function public.moderate_recipe(recipe_id uuid, new_status recipe_status, reason text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then return 'forbidden'; end if;
  update public.recipes
    set status = new_status,
        hidden_reason = case when new_status in ('hidden', 'removed') then left(reason, 300) else null end
    where id = recipe_id;
  return 'ok';
end $$;

revoke execute on function public.publish_recipe(uuid) from public, anon;
revoke execute on function public.unpublish_recipe(uuid) from public, anon;
revoke execute on function public.moderate_recipe(uuid, recipe_status, text) from public, anon;
grant execute on function public.publish_recipe(uuid) to authenticated;
grant execute on function public.unpublish_recipe(uuid) to authenticated;
grant execute on function public.moderate_recipe(uuid, recipe_status, text) to authenticated;

-- ===================================================================
-- 5. Public profile reads, one at a time
-- ===================================================================

-- Byline for recipes on screen: only people with a handle and a live recipe.
create or replace function public.author_cards(ids uuid[])
returns table (id uuid, handle text, public_name text, photo_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle, p.public_name, p.photo_path
  from public.profiles p
  where p.id = any(ids[1:100])
    and p.handle is not null
    and not p.suspended
    and exists (select 1 from public.recipes r where r.author_id = p.id and r.status = 'live');
$$;

-- A profile page: header plus published recipes. Null when the handle does
-- not exist, or the person is suspended.
create or replace function public.profile_by_handle(h text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'handle', p.handle,
    'public_name', p.public_name,
    'photo_path', p.photo_path,
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'photo_path', r.photo_path,
        'serv', r.serv, 'time_min', r.time_min, 'steps', jsonb_array_length(r.steps),
        'cooked_count', r.cooked_count, 'source_creator', r.source_creator
      ) order by r.published_at desc)
      from public.recipes r
      where r.author_id = p.id and r.status = 'live'
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.handle = lower(trim(h)) and not p.suspended;
$$;

grant execute on function public.author_cards(uuid[]) to anon, authenticated;
grant execute on function public.profile_by_handle(text) to anon, authenticated;

-- ===================================================================
-- 6. Share links, opens, and attributed saves/cooks
-- ===================================================================

create table if not exists public.share_links (
  code           text primary key,
  owner_id       uuid not null references auth.users on delete cascade,
  -- catalogue: ref is a shipped recipe id; user: ref is recipes.id;
  -- import: a recipe she imported from a video, credited to its creator.
  recipe_kind    text not null check (recipe_kind in ('catalogue', 'user', 'import')),
  recipe_ref     text not null check (length(recipe_ref) between 1 and 80),
  title          text check (length(title) <= 80),
  source_creator text check (length(source_creator) <= 60),
  source_url     text check (length(source_url) <= 300),
  photo_path     text check (length(photo_path) <= 200),
  format         text not null check (format in ('story', 'feed')),
  created_at     timestamptz not null default now()
);
create index if not exists share_links_owner_idx on public.share_links (owner_id);
create index if not exists share_links_lookup_idx on public.share_links (owner_id, recipe_kind, recipe_ref, format);

create table if not exists public.link_opens (
  code        text not null references public.share_links on delete cascade,
  day         date not null default (now() at time zone 'Asia/Jakarta')::date,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  primary key (code, day, device_hash)
);
create index if not exists link_opens_device_day_idx on public.link_opens (device_hash, day);

create table if not exists public.link_events (
  code        text not null references public.share_links on delete cascade,
  kind        text not null check (kind in ('save', 'cook')),
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  primary key (code, kind, device_hash)
);
create index if not exists link_events_device_idx on public.link_events (device_hash, created_at);

alter table public.share_links enable row level security;
alter table public.link_opens  enable row level security;
alter table public.link_events enable row level security;

-- Nothing is written directly; everything goes through the functions below.
revoke all on public.share_links from anon, authenticated;
revoke all on public.link_opens  from anon, authenticated;
revoke all on public.link_events from anon, authenticated;
grant select, delete on public.share_links to authenticated;
grant select on public.link_opens  to authenticated;
grant select on public.link_events to authenticated;

drop policy if exists "you see your own links" on public.share_links;
create policy "you see your own links" on public.share_links
  for select using (owner_id = auth.uid());
drop policy if exists "you delete your own links" on public.share_links;
create policy "you delete your own links" on public.share_links
  for delete using (owner_id = auth.uid());
drop policy if exists "you see opens of your links" on public.link_opens;
create policy "you see opens of your links" on public.link_opens
  for select using (exists (select 1 from public.share_links s where s.code = link_opens.code and s.owner_id = auth.uid()));
drop policy if exists "you see events of your links" on public.link_events;
create policy "you see events of your links" on public.link_events
  for select using (exists (select 1 from public.share_links s where s.code = link_events.code and s.owner_id = auth.uid()));

-- One link per (person, recipe, card format), reused on every share, so the
-- stats add up per recipe and per format.
create or replace function public.create_share_link(
  kind text, ref text, fmt text,
  title text default null, source_creator text default null,
  source_url text default null, photo_path text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  existing text;
  new_code text;
  tries int := 0;
begin
  if uid is null then return null; end if;
  if kind not in ('catalogue', 'user', 'import') or fmt not in ('story', 'feed') then return null; end if;
  if kind = 'catalogue' and ref !~ '^[a-z0-9_]{2,60}$' then return null; end if;
  if kind = 'user' and not exists (
    select 1 from public.recipes r where r.id::text = ref
      and (r.status = 'live' or r.author_id = uid) and not public.is_suspended(r.author_id)
  ) then return null; end if;
  if photo_path is not null and split_part(photo_path, '/', 1) <> uid::text then photo_path := null; end if;
  if source_url is not null and source_url !~ '^https://' then source_url := null; end if;
  -- 200 links a day is far beyond a real cook and keeps the table small.
  if (select count(*) from public.share_links s where s.owner_id = uid
        and s.created_at > now() - interval '1 day') >= 200 then
    return null;
  end if;

  select s.code into existing from public.share_links s
    where s.owner_id = uid and s.recipe_kind = kind and s.recipe_ref = ref and s.format = fmt
    limit 1;
  if existing is not null then
    -- A newer dish photo replaces the old one on the preview.
    if photo_path is not null then
      update public.share_links s set photo_path = create_share_link.photo_path where s.code = existing;
    end if;
    return existing;
  end if;

  loop
    tries := tries + 1;
    new_code := lower(substr(translate(encode(uuid_send(gen_random_uuid()), 'base64'), '+/=lIO0', ''), 1, 7));
    begin
      insert into public.share_links (code, owner_id, recipe_kind, recipe_ref, title, source_creator, source_url, photo_path, format)
      values (new_code, uid, kind, ref, left(trim(title), 80), left(trim(source_creator), 60), left(source_url, 300), photo_path, fmt);
      return new_code;
    exception when unique_violation then
      if tries > 5 then return null; end if;
    end;
  end loop;
end $$;

-- What the public /r/<code> page shows. Never the owner's private name.
create or replace function public.share_link_public(link_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', s.code,
    'kind', s.recipe_kind,
    'ref', s.recipe_ref,
    'title', coalesce(r.title, s.title),
    'source_creator', coalesce(r.source_creator, s.source_creator),
    'source_url', coalesce(r.source_url, s.source_url),
    'photo_path', coalesce(s.photo_path, r.photo_path),
    'format', s.format,
    'serv', r.serv,
    'time_min', r.time_min,
    'steps', case when r.id is null then null else jsonb_array_length(r.steps) end,
    'recipe_live', r.id is not null,
    'author_handle', a.handle,
    'owner', case when p.handle is null then null else jsonb_build_object(
      'handle', p.handle, 'public_name', p.public_name, 'photo_path', p.photo_path,
      'recipes', coalesce((
        select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'photo_path', x.photo_path)
          order by x.published_at desc)
        from (select * from public.recipes y where y.author_id = p.id and y.status = 'live'
              order by y.published_at desc limit 12) x
      ), '[]'::jsonb)
    ) end
  )
  from public.share_links s
  left join public.profiles p on p.id = s.owner_id and not p.suspended
  left join public.recipes r on s.recipe_kind = 'user' and r.id::text = s.recipe_ref
    and r.status = 'live' and not public.is_suspended(r.author_id)
  left join public.profiles a on a.id = r.author_id
  where s.code = lower(link_code)
    -- A suspended owner's links stop resolving.
    and not public.is_suspended(s.owner_id);
$$;

-- Counted once per device per day. The owner's own taps never count.
create or replace function public.record_link_open(link_code text, device_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if device_hash is null or device_hash !~ '^[0-9a-f]{64}$' then return 'bad'; end if;
  select s.owner_id into owner from public.share_links s where s.code = lower(link_code);
  if owner is null then return 'missing'; end if;
  if owner = auth.uid() then return 'own'; end if;
  -- Rate limits: one device opening more than 40 different links a day, or a
  -- single link passing 5,000 devices in a day, is not a person cooking.
  if (select count(*) from public.link_opens o where o.device_hash = record_link_open.device_hash and o.day = today) >= 40 then
    return 'limited';
  end if;
  if (select count(*) from public.link_opens o where o.code = lower(link_code) and o.day = today) >= 5000 then
    return 'limited';
  end if;
  insert into public.link_opens (code, day, device_hash)
    values (lower(link_code), today, record_link_open.device_hash)
    on conflict do nothing;
  return 'ok';
end $$;

-- A save or a finished cook that came from someone's link. Once per device
-- per link per kind. For a user recipe it also moves the public counter.
create or replace function public.record_link_event(link_code text, kind text, device_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare
  s public.share_links;
  inserted int;
begin
  if kind not in ('save', 'cook') then return 'bad'; end if;
  if device_hash is null or device_hash !~ '^[0-9a-f]{64}$' then return 'bad'; end if;
  select * into s from public.share_links x where x.code = lower(link_code);
  if s.code is null then return 'missing'; end if;
  if s.owner_id = auth.uid() then return 'own'; end if;
  if (select count(*) from public.link_events e where e.device_hash = record_link_event.device_hash
        and e.created_at > now() - interval '1 day') >= 40 then
    return 'limited';
  end if;
  insert into public.link_events (code, kind, device_hash)
    values (s.code, kind, record_link_event.device_hash)
    on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 and s.recipe_kind = 'user' then
    if kind = 'cook' then
      update public.recipes set cooked_count = cooked_count + 1 where id::text = s.recipe_ref and status = 'live';
    else
      update public.recipes set saved_count = saved_count + 1 where id::text = s.recipe_ref and status = 'live';
    end if;
  end if;
  return 'ok';
end $$;

-- The "Resepku" dashboard: one row per link, owner only.
create or replace function public.my_share_stats()
returns table (code text, recipe_kind text, recipe_ref text, title text, format text,
               created_at timestamptz, opens bigint, saves bigint, cooks bigint)
language sql stable security definer set search_path = public as $$
  select s.code, s.recipe_kind, s.recipe_ref, coalesce(r.title, s.title), s.format, s.created_at,
    (select count(*) from public.link_opens o where o.code = s.code),
    (select count(*) from public.link_events e where e.code = s.code and e.kind = 'save'),
    (select count(*) from public.link_events e where e.code = s.code and e.kind = 'cook')
  from public.share_links s
  left join public.recipes r on s.recipe_kind = 'user' and r.id::text = s.recipe_ref
  where s.owner_id = auth.uid()
  order by s.created_at desc;
$$;

revoke execute on function public.create_share_link(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_share_link(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.share_link_public(text) to anon, authenticated;
grant execute on function public.record_link_open(text, text) to anon, authenticated;
grant execute on function public.record_link_event(text, text, text) to anon, authenticated;
revoke execute on function public.my_share_stats() from public, anon;
grant execute on function public.my_share_stats() to authenticated;
