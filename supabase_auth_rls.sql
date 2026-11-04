-- One-time migration for Supabase Auth and per-user access on the NFCFit
-- fitness schema. Run after supabase_fitness_schema.sql.

begin;

alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

create or replace function public.auth_profile_id()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.auth_profile_id() from public, anon;
grant execute on function public.auth_profile_id() to authenticated;

create or replace function public.get_or_create_profile(p_name text default null)
returns table (
  id text,
  name text,
  username text,
  email text,
  avatarurl text,
  daily_goal integer,
  weekly_goal integer,
  weight_kg numeric,
  height_cm numeric,
  age integer,
  fitness_level text,
  createdat timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  auth_user auth.users%rowtype;
  profile public.users%rowtype;
  profile_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into auth_user
  from auth.users
  where auth.users.id = auth.uid();

  if auth_user.id is null or auth_user.email_confirmed_at is null then
    raise exception 'Verify your email before accessing your profile';
  end if;

  select * into profile
  from public.users
  where auth_user_id = auth_user.id;

  if profile.id is null then
    update public.users
         set auth_user_id = auth_user.id
     where lower(public.users.email) = lower(auth_user.email)
       and auth_user_id is null
    returning * into profile;
  end if;

  if profile.id is null then
    profile_name := coalesce(
      nullif(btrim(p_name), ''),
      nullif(auth_user.raw_user_meta_data ->> 'name', ''),
      split_part(auth_user.email, '@', 1)
    );

    insert into public.users (
      id,
      auth_user_id,
      name,
      username,
      email,
      avatarurl,
      passwordhash
    )
    values (
      auth_user.id::text,
      auth_user.id,
      profile_name,
      lower(split_part(auth_user.email, '@', 1)) || '_' || substr(auth_user.id::text, 1, 8),
      auth_user.email,
      auth_user.raw_user_meta_data ->> 'avatar_url',
      null
    )
    returning * into profile;
  end if;

  return query
  select profile.id, profile.name, profile.username, profile.email,
         profile.avatarurl, profile.daily_goal, profile.weekly_goal,
         profile.weight_kg, profile.height_cm, profile.age,
         profile.fitness_level, profile.createdat;
end;
$$;

revoke all on function public.get_or_create_profile(text) from public, anon;
grant execute on function public.get_or_create_profile(text) to authenticated;

create or replace view public.daily_goal_progress
with (security_invoker = true)
as
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
join public.user_exercises ue
  on ue.user_id = dg.user_id
 and ue.exercise_type_id = dg.exercise_type_id
 and ue.active is true
left join public.exercise_logs el
  on el.user_id = dg.user_id
 and el.exercise_type_id = dg.exercise_type_id
where dg.active is true
group by dg.user_id, dg.exercise_type_id, et.name, dg.target_quantity, dg.unit;

revoke all on public.daily_goal_progress from public, anon, authenticated;

alter table public.users enable row level security;
alter table public.exercise_types enable row level security;
alter table public.user_exercises enable row level security;
alter table public.locations enable row level security;
alter table public.wellness_types enable row level security;
alter table public.wellness_goals enable row level security;
alter table public.wellness_logs enable row level security;
alter table public.exercise_tags enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.daily_goals enable row level security;
alter table public.health_integrations enable row level security;
alter table public.nfc_scan_events enable row level security;

revoke all on public.users, public.exercise_types, public.user_exercises,
  public.locations, public.wellness_types, public.wellness_goals,
  public.wellness_logs, public.exercise_tags, public.exercise_logs,
  public.daily_goals, public.health_integrations, public.nfc_scan_events
from public, anon, authenticated;

grant select (id, name, username, email, avatarurl, daily_goal, weekly_goal,
  weight_kg, height_cm, age, fitness_level, createdat)
  on public.users to authenticated;
grant update (name, username, avatarurl, daily_goal, weekly_goal, weight_kg,
  height_cm, age, fitness_level)
  on public.users to authenticated;
grant select on public.exercise_types, public.locations, public.wellness_types
  to authenticated;
grant select on public.daily_goal_progress to authenticated;
grant select, insert, update, delete on public.user_exercises,
  public.wellness_goals, public.wellness_logs, public.exercise_tags,
  public.exercise_logs, public.daily_goals, public.health_integrations
  to authenticated;
grant select on public.nfc_scan_events to authenticated;

drop policy if exists exercise_types_read_authenticated on public.exercise_types;
create policy exercise_types_read_authenticated on public.exercise_types
  for select to authenticated using (true);

drop policy if exists locations_read_authenticated on public.locations;
create policy locations_read_authenticated on public.locations
  for select to authenticated using (true);

drop policy if exists wellness_types_read_authenticated on public.wellness_types;
create policy wellness_types_read_authenticated on public.wellness_types
  for select to authenticated using (true);

drop policy if exists users_read_own_profile on public.users;
create policy users_read_own_profile on public.users
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists users_update_own_profile on public.users;
create policy users_update_own_profile on public.users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists user_exercises_own_rows on public.user_exercises;
create policy user_exercises_own_rows on public.user_exercises
  for all to authenticated
  using (user_id = public.auth_profile_id())
  with check (user_id = public.auth_profile_id());

drop policy if exists daily_goals_own_rows on public.daily_goals;
create policy daily_goals_own_rows on public.daily_goals
  for all to authenticated
  using (user_id = public.auth_profile_id())
  with check (user_id = public.auth_profile_id());

drop policy if exists exercise_logs_own_rows on public.exercise_logs;
create policy exercise_logs_own_rows on public.exercise_logs
  for all to authenticated
  using (user_id = public.auth_profile_id())
  with check (user_id = public.auth_profile_id());

drop policy if exists wellness_goals_own_rows on public.wellness_goals;
create policy wellness_goals_own_rows on public.wellness_goals
  for all to authenticated
  using (user_id = public.auth_profile_id())
  with check (user_id = public.auth_profile_id());

drop policy if exists wellness_logs_own_rows on public.wellness_logs;
create policy wellness_logs_own_rows on public.wellness_logs
  for all to authenticated
  using (user_id = public.auth_profile_id())
  with check (user_id = public.auth_profile_id());

drop policy if exists health_integrations_own_rows on public.health_integrations;
create policy health_integrations_own_rows on public.health_integrations
  for all to authenticated
  using (user_id = public.auth_profile_id())
  with check (user_id = public.auth_profile_id());

drop policy if exists exercise_tags_visible_to_owner on public.exercise_tags;
create policy exercise_tags_visible_to_owner on public.exercise_tags
  for select to authenticated
  using (assigned_user_id is null or assigned_user_id = public.auth_profile_id());

drop policy if exists exercise_tags_manage_own on public.exercise_tags;
create policy exercise_tags_manage_own on public.exercise_tags
  for all to authenticated
  using (assigned_user_id = public.auth_profile_id())
  with check (assigned_user_id = public.auth_profile_id());

drop policy if exists nfc_scan_events_read_own on public.nfc_scan_events;
create policy nfc_scan_events_read_own on public.nfc_scan_events
  for select to authenticated
  using (user_id = public.auth_profile_id());

do $$
begin
  if to_regprocedure('public.log_exercise_from_nfc_unchecked(text,text,text,timestamp with time zone)') is null then
    alter function public.log_exercise_from_nfc(text, text, text, timestamptz)
      rename to log_exercise_from_nfc_unchecked;
  end if;
end;
$$;

revoke all on function public.log_exercise_from_nfc_unchecked(text, text, text, timestamptz)
  from public, anon, authenticated;

create or replace function public.log_exercise_from_nfc(
  p_uid text,
  p_ndef_payload text default null,
  p_user_id text default null,
  p_logged_at timestamptz default now()
)
returns table (
  log_id uuid,
  tag_id text,
  action_domain text,
  exercise_type_id text,
  exercise_name text,
  wellness_type_id text,
  wellness_name text,
  quantity numeric,
  unit text,
  calorie_estimate numeric,
  location_id text,
  location_name text,
  result text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_id text;
begin
  profile_id := public.auth_profile_id();
  if profile_id is null then
    raise exception 'Authentication required';
  end if;
  if p_user_id is not null and p_user_id <> profile_id then
    raise exception 'Cannot log activity for another user';
  end if;

  return query
  select *
  from public.log_exercise_from_nfc_unchecked(
    p_uid, p_ndef_payload, profile_id, p_logged_at
  );
end;
$$;

revoke all on function public.log_exercise_from_nfc(text, text, text, timestamptz)
  from public, anon;
grant execute on function public.log_exercise_from_nfc(text, text, text, timestamptz)
  to authenticated;

commit;
