-- Racik — user-posted recipes.
--
-- Design notes that matter more than the SQL:
--
--  * `ings` keeps the same shape as the shipped recipes in src/data/recipes.json,
--    so one renderer, one scaler and one shopping-list merge serve both. A line
--    either resolves to an ontology id (the engine can scale it) or carries
--    raw text (the engine leaves it alone and the UI says so).
--  * There is no halal column, deliberately. The green chip is a promise Weni
--    keeps personally on the 199 shipped recipes. A user recipe must never
--    carry a verdict nobody verified.
--  * Row Level Security carries the permission rules rather than application
--    code, so a new endpoint cannot accidentally skip them.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null check (length(trim(name)) between 2 and 40),
  created_at  timestamptz not null default now(),
  -- set by a moderator; a suspended author's recipes stop being served
  suspended   boolean not null default false
);

-- ---------------------------------------------------------------- recipes
create type recipe_status as enum ('draft', 'live', 'hidden', 'removed');

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles on delete cascade,
  title         text not null check (length(trim(title)) between 3 and 80),
  serv          int  not null check (serv between 1 and 20),
  note          text check (length(note) <= 300),
  region        text,
  photo_path    text,
  ings          jsonb not null default '[]'::jsonb,
  steps         jsonb not null default '[]'::jsonb,
  status        recipe_status not null default 'draft',
  -- filled by a moderator when hiding; shown to the author verbatim
  hidden_reason text,
  cooked_count  int not null default 0,
  saved_count   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);

create index recipes_live_idx on public.recipes (published_at desc) where status = 'live';
create index recipes_author_idx on public.recipes (author_id);

-- ---------------------------------------------------------------- reports
-- Google Play requires in-app reporting of both content and users.
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  recipe_id   uuid references public.recipes on delete cascade,
  subject_id  uuid references public.profiles on delete cascade,
  reason      text not null,
  detail      text check (length(detail) <= 500),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  check (recipe_id is not null or subject_id is not null)
);

-- ---------------------------------------------------------------- blocks
-- Google Play requires in-app user blocking on a public UGC platform.
create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------- moderators
create table public.moderators (
  user_id uuid primary key references public.profiles on delete cascade
);

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles   enable row level security;
alter table public.recipes    enable row level security;
alter table public.reports    enable row level security;
alter table public.blocks     enable row level security;
alter table public.moderators enable row level security;

create policy "profiles are public" on public.profiles
  for select using (true);
create policy "you edit your own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "you create your own profile" on public.profiles
  for insert with check (id = auth.uid());

-- Anyone may read a live recipe, unless its author is suspended or the reader
-- has blocked them. An author always sees their own, whatever the status.
create policy "live recipes are public" on public.recipes
  for select using (
    (status = 'live'
      and not exists (select 1 from public.profiles p where p.id = author_id and p.suspended)
      and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = author_id))
    or author_id = auth.uid()
    or public.is_moderator()
  );

create policy "you post as yourself" on public.recipes
  for insert with check (author_id = auth.uid());

-- An author may edit their own, but may not un-hide something a moderator hid.
create policy "you edit your own recipes" on public.recipes
  for update using (author_id = auth.uid() and status <> 'removed')
  with check (author_id = auth.uid() and status in ('draft', 'live'));

create policy "you delete your own recipes" on public.recipes
  for delete using (author_id = auth.uid());

create policy "moderators may act on any recipe" on public.recipes
  for update using (public.is_moderator());

create policy "anyone signed in may report" on public.reports
  for insert with check (reporter_id = auth.uid());
create policy "you see your own reports" on public.reports
  for select using (reporter_id = auth.uid() or public.is_moderator());

create policy "you manage your own blocks" on public.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy "moderator list is private" on public.moderators
  for select using (public.is_moderator());

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();
