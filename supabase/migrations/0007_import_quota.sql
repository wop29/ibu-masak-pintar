-- Racik 0007: Tambah Resep quota, rate limits and real cost logging.
--
-- Why: every import is a paid Gemini call, and the import endpoints are public.
-- This migration gives the Worker one place to ask "may this person import
-- now?" and to record what each import really cost (tokens per model).
--
-- Security model
--  * Only the Worker calls these functions. It uses the publishable key, so the
--    functions are reachable from the internet. Each one therefore requires a
--    server-held secret (Worker secret IMPORT_RPC_SECRET). Only its SHA-256 hash
--    is stored here, in a schema the API does not expose.
--  * The usage table has RLS on and no policies: nobody reads or writes it
--    through the API. The founder reads it in the SQL editor.
--  * record_missing_ingredient (0005) was callable by anyone with the public
--    key. It now needs the same secret, and stops at 20 000 rows.
--
-- Safe to run more than once.
--
-- AFTER RUNNING, set the secret (pick a long random string, 32+ characters,
-- and use the SAME value for `wrangler secret put IMPORT_RPC_SECRET`):
--
--   insert into racik_private.server_secrets (name, secret_hash)
--   values ('import_rpc', encode(extensions.digest('PASTE-THE-SECRET-HERE', 'sha256'), 'hex'))
--   on conflict (name) do update set secret_hash = excluded.secret_hash, updated_at = now();
--
-- Cost per day (SQL editor):
--   select * from racik_private.import_usage_daily order by day desc limit 30;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Private schema: not in the API's exposed schemas, no grants to API roles.
create schema if not exists racik_private;
revoke all on schema racik_private from public;
revoke all on schema racik_private from anon, authenticated;

create table if not exists racik_private.server_secrets (
  name        text primary key,
  secret_hash text not null,
  updated_at  timestamptz not null default now()
);
revoke all on racik_private.server_secrets from public;
revoke all on racik_private.server_secrets from anon, authenticated;

create or replace function racik_private.secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null
     and length(p_secret) >= 24
     and exists (
       select 1 from racik_private.server_secrets s
       where s.name = 'import_rpc'
         and s.secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
     );
$$;
revoke all on function racik_private.secret_ok(text) from public;
revoke all on function racik_private.secret_ok(text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- One row per import attempt.
--   subject: 'u:<user uuid>' when signed in, 'd:<random device id>' otherwise.
--   ip_hash: salted SHA-256 of the caller's IP (never the IP itself). Cleared
--            after 7 days.
--   result:  the finished recipe, kept up to 2 days so a page that reloaded
--            mid-import can still pick it up. Cleared after that.
create table if not exists public.import_usage (
  id                 uuid primary key,
  created_at         timestamptz not null default now(),
  finished_at        timestamptz,
  subject            text not null check (length(subject) between 3 and 80),
  user_id            uuid references auth.users (id) on delete cascade,
  ip_hash            text check (ip_hash is null or length(ip_hash) <= 64),
  source             text not null check (source in ('link', 'suara', 'berkas', 'teks', 'foto')),
  status             text not null default 'started'
                     check (status in ('started', 'ok', 'no_recipe', 'failed', 'denied')),
  reason             text check (reason is null or length(reason) <= 120),
  model              text check (model is null or length(model) <= 80),
  gemini_calls       integer not null default 0,
  prompt_tokens      integer not null default 0,
  candidates_tokens  integer not null default 0,
  thoughts_tokens    integer not null default 0,
  latency_ms         integer,
  result             jsonb check (result is null or pg_column_size(result) < 200000)
);

create index if not exists import_usage_subject_idx on public.import_usage (subject, created_at desc);
create index if not exists import_usage_ip_idx on public.import_usage (ip_hash, created_at desc) where ip_hash is not null;
create index if not exists import_usage_created_idx on public.import_usage (created_at desc);

alter table public.import_usage enable row level security;
-- No policies on purpose. Also take away the default table grants.
revoke all on public.import_usage from anon, authenticated;

-- Founder view: real cost per day and per model.
create or replace view racik_private.import_usage_daily as
select
  date_trunc('day', created_at at time zone 'Asia/Jakarta')::date as day,
  source,
  model,
  count(*) filter (where status = 'ok')        as ok,
  count(*) filter (where status = 'no_recipe') as no_recipe,
  count(*) filter (where status = 'failed')    as failed,
  count(*) filter (where status = 'denied')    as denied,
  sum(gemini_calls)       as gemini_calls,
  sum(prompt_tokens)      as prompt_tokens,
  sum(candidates_tokens)  as candidates_tokens,
  sum(thoughts_tokens)    as thoughts_tokens,
  round(avg(latency_ms))  as avg_latency_ms
from public.import_usage
group by 1, 2, 3;
revoke all on racik_private.import_usage_daily from public;
revoke all on racik_private.import_usage_daily from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Racik Plus seam. Returns the end of a paid entitlement, or null.
-- Reads public.entitlements(user_id uuid, plus_until timestamptz) only if that
-- table exists, so this migration does not need it. When Racik Plus ships,
-- create that table and nothing here has to change.
create or replace function racik_private.plus_until(p_user uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if p_user is null or to_regclass('public.entitlements') is null then
    return null;
  end if;
  begin
    execute 'select max(plus_until) from public.entitlements where user_id = $1'
      into v_until using p_user;
  exception when others then
    return null;
  end;
  return v_until;
end;
$$;
revoke all on function racik_private.plus_until(uuid) from public;
revoke all on function racik_private.plus_until(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- import_reserve: records the attempt and returns the counters the Worker
-- needs to decide. The Worker applies the limits (src/lib/racik/import-quota.ts)
-- and calls import_finish with 'denied' when it says no.
create or replace function public.import_reserve(
  p_secret     text,
  p_request_id uuid,
  p_subject    text,
  p_user_id    uuid,
  p_ip_hash    text,
  p_source     text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_inserted    integer;
  v_month_used  integer;
  v_subject_day integer;
  v_ip_10m      integer := 0;
  v_ip_day      integer := 0;
  v_global_day  integer;
begin
  if not racik_private.secret_ok(p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Light housekeeping, about once every 50 calls.
  if random() < 0.02 then
    update public.import_usage set ip_hash = null
      where ip_hash is not null and created_at < now() - interval '7 days';
    update public.import_usage set result = null
      where result is not null and created_at < now() - interval '2 days';
  end if;

  insert into public.import_usage (id, subject, user_id, ip_hash, source)
  values (p_request_id, p_subject, p_user_id, nullif(p_ip_hash, ''), p_source)
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true);
  end if;

  -- Successes this month, plus other attempts still running (so two parallel
  -- imports cannot both take the last slot).
  select count(*) into v_month_used
  from public.import_usage
  where subject = p_subject
    and created_at >= v_month_start
    and id <> p_request_id
    and (status = 'ok' or (status = 'started' and created_at > now() - interval '5 minutes'));

  select count(*) into v_subject_day
  from public.import_usage
  where subject = p_subject
    and created_at > now() - interval '1 day'
    and status <> 'denied'
    and id <> p_request_id;

  if coalesce(p_ip_hash, '') <> '' then
    select count(*) filter (where created_at > now() - interval '10 minutes'),
           count(*)
      into v_ip_10m, v_ip_day
    from public.import_usage
    where ip_hash = p_ip_hash
      and created_at > now() - interval '1 day'
      and id <> p_request_id;
  end if;

  select count(*) into v_global_day
  from public.import_usage
  where created_at > now() - interval '1 day'
    and status <> 'denied'
    and id <> p_request_id;

  return jsonb_build_object(
    'month_used',  v_month_used,
    'subject_day', v_subject_day,
    'ip_10m',      v_ip_10m,
    'ip_day',      v_ip_day,
    'global_day',  v_global_day,
    'plus_until',  racik_private.plus_until(p_user_id)
  );
end;
$$;

-- import_finish: outcome and real token usage for one attempt.
create or replace function public.import_finish(
  p_secret            text,
  p_request_id        uuid,
  p_status            text,
  p_reason            text,
  p_model             text,
  p_gemini_calls      integer,
  p_prompt_tokens     integer,
  p_candidates_tokens integer,
  p_thoughts_tokens   integer,
  p_latency_ms        integer,
  p_result            jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not racik_private.secret_ok(p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.import_usage
     set status            = case when p_status in ('ok', 'no_recipe', 'failed', 'denied') then p_status else 'failed' end,
         reason            = left(p_reason, 120),
         model             = left(p_model, 80),
         gemini_calls      = greatest(coalesce(p_gemini_calls, 0), 0),
         prompt_tokens     = greatest(coalesce(p_prompt_tokens, 0), 0),
         candidates_tokens = greatest(coalesce(p_candidates_tokens, 0), 0),
         thoughts_tokens   = greatest(coalesce(p_thoughts_tokens, 0), 0),
         latency_ms        = p_latency_ms,
         result            = case when p_result is not null and pg_column_size(p_result) < 200000 then p_result else null end,
         finished_at       = now()
   where id = p_request_id
     and status = 'started';
end;
$$;

-- import_status: what the import sheet shows ("Sisa 7 dari 10 bulan ini").
create or replace function public.import_status(
  p_secret  text,
  p_subject text,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_month_used  integer;
begin
  if not racik_private.secret_ok(p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into v_month_used
  from public.import_usage
  where subject = p_subject and created_at >= v_month_start and status = 'ok';
  return jsonb_build_object('month_used', v_month_used, 'plus_until', racik_private.plus_until(p_user_id));
end;
$$;

-- import_result: lets the same device or account pick up a finished import
-- after the page reloaded mid-way.
create or replace function public.import_result(
  p_secret     text,
  p_request_id uuid,
  p_subject    text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.import_usage%rowtype;
begin
  if not racik_private.secret_ok(p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_row from public.import_usage
  where id = p_request_id and subject = p_subject and created_at > now() - interval '2 days';
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  return jsonb_build_object('status', v_row.status, 'reason', v_row.reason, 'result', v_row.result);
end;
$$;

revoke all on function public.import_reserve(text, uuid, text, uuid, text, text) from public;
revoke all on function public.import_finish(text, uuid, text, text, text, integer, integer, integer, integer, integer, jsonb) from public;
revoke all on function public.import_status(text, text, uuid) from public;
revoke all on function public.import_result(text, uuid, text) from public;
-- The Worker calls with the publishable key (role anon). The secret is the gate.
grant execute on function public.import_reserve(text, uuid, text, uuid, text, text) to anon, service_role;
grant execute on function public.import_finish(text, uuid, text, text, text, integer, integer, integer, integer, integer, jsonb) to anon, service_role;
grant execute on function public.import_status(text, text, uuid) to anon, service_role;
grant execute on function public.import_result(text, uuid, text) to anon, service_role;
revoke execute on function public.import_reserve(text, uuid, text, uuid, text, text) from authenticated;
revoke execute on function public.import_finish(text, uuid, text, text, text, integer, integer, integer, integer, integer, jsonb) from authenticated;
revoke execute on function public.import_status(text, text, uuid) from authenticated;
revoke execute on function public.import_result(text, uuid, text) from authenticated;

-- ---------------------------------------------------------------------------
-- Lock down record_missing_ingredient (audit P1-5).
-- The old one-argument version was callable by anyone. Remove it and replace
-- it with a version that needs the server secret, accepts only plain
-- ingredient-like text, and stops growing at 20 000 names.
drop function if exists public.record_missing_ingredient(text);

create or replace function public.record_missing_ingredient(p_secret text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not racik_private.secret_ok(p_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  p_name := lower(btrim(p_name));
  if p_name is null or length(p_name) < 2 or length(p_name) > 80 then
    return;
  end if;
  -- Letters (any script), digits, spaces and a little punctuation only.
  if p_name !~ '^[[:alpha:][:digit:] .,''()/&-]+$' then
    return;
  end if;
  if not exists (select 1 from public.missing_ingredients where name = p_name)
     and (select count(*) from public.missing_ingredients) >= 20000 then
    return;
  end if;
  insert into public.missing_ingredients (name) values (p_name)
  on conflict (name) do update
    set count = public.missing_ingredients.count + 1,
        last_seen = now();
end;
$$;

revoke all on function public.record_missing_ingredient(text, text) from public;
revoke execute on function public.record_missing_ingredient(text, text) from authenticated;
grant execute on function public.record_missing_ingredient(text, text) to anon, service_role;
revoke all on public.missing_ingredients from anon, authenticated;
