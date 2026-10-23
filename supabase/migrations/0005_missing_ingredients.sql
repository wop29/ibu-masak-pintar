-- Racik grows its own ingredient dictionary from what users actually import.
--
-- Every imported ingredient Racik could not resolve is recorded here, counted,
-- so the most-wanted missing ingredients rise to the top — a ranked to-do list
-- for enriching the ontology. The user is never told their ingredient is
-- "not in the list"; this is how Racik quietly closes the gap behind the scenes.
--
-- Writes go only through record_missing_ingredient() (SECURITY DEFINER), so the
-- anon key can record a name without any direct table access.

create table if not exists public.missing_ingredients (
  name        text primary key,
  count       integer not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

alter table public.missing_ingredients enable row level security;
-- No policies: the table is reachable only via the function below (and the
-- service role in the dashboard). To see the list: 
--   select * from missing_ingredients order by count desc;

create or replace function public.record_missing_ingredient(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  p_name := lower(btrim(p_name));
  if p_name is null or length(p_name) = 0 or length(p_name) > 120 then
    return;
  end if;
  insert into public.missing_ingredients(name) values (p_name)
  on conflict (name) do update
    set count = public.missing_ingredients.count + 1,
        last_seen = now();
end;
$$;

grant execute on function public.record_missing_ingredient(text) to anon, authenticated;
