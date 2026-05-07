-- Clean schema for NFC Fitness Tracker.
-- Run this in a new Supabase project. It intentionally does not depend on the old task schema.

create extension if not exists pgcrypto;

drop view if exists public.daily_goal_progress;
drop function if exists public.log_exercise_from_nfc(text, text, text, timestamptz);
drop table if exists public.nfc_scan_events cascade;
drop table if exists public.health_integrations cascade;
drop table if exists public.daily_goals cascade;
drop table if exists public.exercise_logs cascade;
drop table if exists public.exercise_tags cascade;
drop table if exists public.locations cascade;
drop table if exists public.exercise_types cascade;
drop table if exists public.users cascade;

create table public.users (
  id text primary key,
  name text not null,
  username text unique,
  email text,
  avatarurl text,
  passwordhash text,
  daily_goal integer default 0,
  weekly_goal integer default 0,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  age integer check (age is null or age between 1 and 120),
  fitness_level text check (fitness_level is null or fitness_level in ('beginner', 'intermediate', 'advanced', 'athlete')),
  createdat timestamptz not null default now()
);

create table public.exercise_types (
  id text primary key,
  name text not null,
  category text not null check (category in ('strength', 'core', 'cardio', 'mobility', 'rehab', 'other')),
  unit text not null check (unit in ('repetition', 'seconds', 'minutes', 'meters')),
  default_calorie_per_unit numeric(10,4) not null default 0,
  createdat timestamptz not null default now()
);

create table public.locations (
  id text primary key,
  name text not null,
  type text check (type is null or type in ('home', 'gym', 'park', 'office', 'studio', 'other')),
  description text,
  createdat timestamptz not null default now()
);

create table public.exercise_tags (
  id text primary key,
  nfc_uid text unique not null,
  ndef_payload text,
  name text not null,
  exercise_type_id text not null references public.exercise_types(id) on delete restrict,
  quantity numeric(10,2) not null check (quantity > 0),
  unit text not null check (unit in ('repetition', 'seconds', 'minutes', 'meters')),
  calorie_estimate numeric(10,2),
  difficulty_level text check (difficulty_level is null or difficulty_level in ('easy', 'medium', 'hard')),
  location_id text references public.locations(id) on delete set null,
  assigned_user_id text references public.users(id) on delete set null,
  is_active boolean not null default true,
  read_counter integer not null default 0,
  last_scanned_at timestamptz,
  createdat timestamptz not null default now()
);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  tag_id text references public.exercise_tags(id) on delete set null,
  exercise_type_id text not null references public.exercise_types(id) on delete restrict,
  quantity numeric(10,2) not null check (quantity > 0),
  unit text not null check (unit in ('repetition', 'seconds', 'minutes', 'meters')),
  calorie_estimate numeric(10,2) not null default 0,
  source text not null default 'nfc' check (source in ('nfc', 'manual', 'health_import')),
  location_id text references public.locations(id) on delete set null,
  synced_to_health boolean not null default false,
  createdat timestamptz not null default now()
);

create table public.daily_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  exercise_type_id text not null references public.exercise_types(id) on delete cascade,
  target_quantity numeric(10,2) not null check (target_quantity > 0),
  unit text not null check (unit in ('repetition', 'seconds', 'minutes', 'meters')),
  active boolean not null default true,
  createdat timestamptz not null default now(),
  unique (user_id, exercise_type_id)
);

create table public.health_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('apple_health', 'health_connect', 'google_fit', 'samsung_health')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  last_synced_at timestamptz,
  createdat timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.nfc_scan_events (
  id uuid primary key default gen_random_uuid(),
  tag_id text references public.exercise_tags(id) on delete set null,
  nfc_uid text,
  ndef_payload text,
  user_id text references public.users(id) on delete set null,
  location_id text references public.locations(id) on delete set null,
  result text not null check (result in ('logged', 'no_tag', 'inactive_tag', 'user_mismatch', 'error')),
  details jsonb not null default '{}'::jsonb,
  createdat timestamptz not null default now()
);

create index exercise_tags_nfc_uid_idx on public.exercise_tags(nfc_uid);
create index exercise_tags_exercise_type_idx on public.exercise_tags(exercise_type_id);
create index exercise_logs_user_created_idx on public.exercise_logs(user_id, createdat desc);
create index exercise_logs_exercise_type_created_idx on public.exercise_logs(exercise_type_id, createdat desc);
create index daily_goals_user_idx on public.daily_goals(user_id);
create index nfc_scan_events_created_idx on public.nfc_scan_events(createdat desc);

create or replace view public.daily_goal_progress as
select
  dg.user_id,
  dg.exercise_type_id,
  et.name as exercise_name,
  dg.target_quantity,
  dg.unit,
  coalesce(sum(el.quantity) filter (
    where el.createdat >= date_trunc('day', now())
      and el.createdat < date_trunc('day', now()) + interval '1 day'
  ), 0) as completed_quantity,
  greatest(dg.target_quantity - coalesce(sum(el.quantity) filter (
    where el.createdat >= date_trunc('day', now())
      and el.createdat < date_trunc('day', now()) + interval '1 day'
  ), 0), 0) as remaining_quantity
from public.daily_goals dg
join public.exercise_types et on et.id = dg.exercise_type_id
left join public.exercise_logs el
  on el.user_id = dg.user_id
 and el.exercise_type_id = dg.exercise_type_id
where dg.active is true
group by dg.user_id, dg.exercise_type_id, et.name, dg.target_quantity, dg.unit;

create or replace function public.log_exercise_from_nfc(
  p_uid text,
  p_ndef_payload text default null,
  p_user_id text default null,
  p_logged_at timestamptz default now()
)
returns table (
  log_id uuid,
  tag_id text,
  exercise_type_id text,
  exercise_name text,
  quantity numeric,
  unit text,
  calorie_estimate numeric,
  location_id text,
  location_name text,
  result text
)
language plpgsql
security definer
as $$
declare
  matched_tag public.exercise_tags%rowtype;
  matched_type public.exercise_types%rowtype;
  matched_location public.locations%rowtype;
  inserted_log public.exercise_logs%rowtype;
  computed_calories numeric(10,2);
  effective_user_id text;
begin
  select *
    into matched_tag
    from public.exercise_tags
   where nfc_uid = p_uid
      or (p_ndef_payload is not null and ndef_payload = p_ndef_payload)
   limit 1;

  if matched_tag.id is null then
    insert into public.nfc_scan_events (nfc_uid, ndef_payload, user_id, result)
    values (p_uid, p_ndef_payload, p_user_id, 'no_tag');
    return query select null::uuid, null::text, null::text, null::text, null::numeric, null::text, null::numeric, null::text, null::text, 'no_tag'::text;
    return;
  end if;

  if matched_tag.is_active is not true then
    insert into public.nfc_scan_events (tag_id, nfc_uid, ndef_payload, user_id, location_id, result)
    values (matched_tag.id, p_uid, p_ndef_payload, p_user_id, matched_tag.location_id, 'inactive_tag');
    return query select null::uuid, matched_tag.id, matched_tag.exercise_type_id, null::text, matched_tag.quantity, matched_tag.unit, null::numeric, matched_tag.location_id, null::text, 'inactive_tag'::text;
    return;
  end if;

  if matched_tag.assigned_user_id is not null and p_user_id is not null and matched_tag.assigned_user_id <> p_user_id then
    insert into public.nfc_scan_events (tag_id, nfc_uid, ndef_payload, user_id, location_id, result)
    values (matched_tag.id, p_uid, p_ndef_payload, p_user_id, matched_tag.location_id, 'user_mismatch');
    return query select null::uuid, matched_tag.id, matched_tag.exercise_type_id, null::text, matched_tag.quantity, matched_tag.unit, null::numeric, matched_tag.location_id, null::text, 'user_mismatch'::text;
    return;
  end if;

  effective_user_id := coalesce(p_user_id, matched_tag.assigned_user_id);
  if effective_user_id is null then
    insert into public.nfc_scan_events (tag_id, nfc_uid, ndef_payload, user_id, location_id, result, details)
    values (matched_tag.id, p_uid, p_ndef_payload, p_user_id, matched_tag.location_id, 'error', '{"reason": "missing_user"}'::jsonb);
    return query select null::uuid, matched_tag.id, matched_tag.exercise_type_id, null::text, matched_tag.quantity, matched_tag.unit, null::numeric, matched_tag.location_id, null::text, 'error'::text;
    return;
  end if;

  select * into matched_type from public.exercise_types where id = matched_tag.exercise_type_id;
  select * into matched_location from public.locations where id = matched_tag.location_id;

  computed_calories := coalesce(matched_tag.calorie_estimate, matched_tag.quantity * matched_type.default_calorie_per_unit, 0);

  insert into public.exercise_logs (
    user_id,
    tag_id,
    exercise_type_id,
    quantity,
    unit,
    calorie_estimate,
    source,
    location_id,
    createdat
  )
  values (
    effective_user_id,
    matched_tag.id,
    matched_tag.exercise_type_id,
    matched_tag.quantity,
    matched_tag.unit,
    computed_calories,
    'nfc',
    matched_tag.location_id,
    p_logged_at
  )
  returning * into inserted_log;

  update public.exercise_tags
     set read_counter = read_counter + 1,
         last_scanned_at = p_logged_at
   where id = matched_tag.id;

  insert into public.nfc_scan_events (tag_id, nfc_uid, ndef_payload, user_id, location_id, result)
  values (matched_tag.id, p_uid, p_ndef_payload, inserted_log.user_id, matched_tag.location_id, 'logged');

  return query
  select
    inserted_log.id,
    matched_tag.id,
    matched_type.id,
    matched_type.name,
    inserted_log.quantity,
    inserted_log.unit,
    inserted_log.calorie_estimate,
    matched_location.id,
    matched_location.name,
    'logged'::text;
end;
$$;

insert into public.users (id, name, username, email, avatarurl, passwordhash, daily_goal, weekly_goal, weight_kg, height_cm, age, fitness_level)
values
  ('u1', 'Serkan', 'serkan', 'serkan@example.com', 'https://i.pravatar.cc/150?u=serkan', '1234', 150, 900, 82, 178, 34, 'intermediate');

insert into public.exercise_types (id, name, category, unit, default_calorie_per_unit)
values
  ('push_up', 'Push-up', 'strength', 'repetition', 0.32),
  ('squat', 'Squat', 'strength', 'repetition', 0.30),
  ('plank', 'Plank', 'core', 'seconds', 0.05),
  ('sit_up', 'Sit-up', 'core', 'repetition', 0.28),
  ('walking', 'Walking', 'cardio', 'meters', 0.04);

insert into public.locations (id, name, type, description)
values
  ('home', 'Home', 'home', 'Home workout area'),
  ('gym', 'Gym', 'gym', 'Fitness club'),
  ('park', 'Park', 'park', 'Outdoor training area'),
  ('office', 'Office', 'office', 'Office wellness area');

insert into public.exercise_tags (id, nfc_uid, ndef_payload, name, exercise_type_id, quantity, unit, calorie_estimate, difficulty_level, location_id, assigned_user_id)
values
  ('TAG-001', '04:6a:9c:8d:a8:67:80', 'pushup-10', 'Push-up Tag', 'push_up', 10, 'repetition', 3.2, 'medium', 'home', 'u1'),
  ('TAG-002', '04:6a:9c:8d:a8:67:81', 'squat-20', 'Squat Tag', 'squat', 20, 'repetition', 6.0, 'medium', 'home', 'u1'),
  ('TAG-003', '04:6a:9c:8d:a8:67:82', 'plank-60', 'Plank Tag', 'plank', 60, 'seconds', 3.0, 'hard', 'home', 'u1'),
  ('TAG-004', '04:6a:9c:8d:a8:67:83', 'situp-10', 'Sit-up Tag', 'sit_up', 10, 'repetition', 2.8, 'medium', 'gym', 'u1'),
  ('TAG-005', '04:6a:9c:8d:a8:67:84', 'walk-500', 'Walking Tag', 'walking', 500, 'meters', 20.0, 'easy', 'park', 'u1');

insert into public.daily_goals (user_id, exercise_type_id, target_quantity, unit)
values
  ('u1', 'push_up', 50, 'repetition'),
  ('u1', 'squat', 100, 'repetition'),
  ('u1', 'plank', 300, 'seconds');

insert into public.health_integrations (user_id, provider, status)
values
  ('u1', 'apple_health', 'disconnected'),
  ('u1', 'health_connect', 'disconnected');
