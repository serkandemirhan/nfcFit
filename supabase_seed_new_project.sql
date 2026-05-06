-- Full reset + seed for NFC Task Tracker Supabase project.
-- Run in Supabase Dashboard > SQL Editor.
--
-- WARNING: This deletes the existing app tables and demo RPC before recreating them.
-- The anon RLS policies below are intentionally permissive for a demo/internal prototype.
-- Tighten policies before exposing the project publicly.

begin;

create extension if not exists pgcrypto;

drop function if exists public.verify_tag(text);
drop function if exists public.verify_nfc_scan(text, text, text);
drop function if exists public.complete_task_from_nfc(text, text, text, text, text);

drop table if exists public.task_tags cascade;
drop table if exists public.task_completion_events cascade;
drop table if exists public.nfc_scan_events cascade;
drop table if exists public.card_events cascade;
drop table if exists public.task_logs cascade;
drop table if exists public.attachments cascade;
drop table if exists public.tasks cascade;
drop table if exists public.locations cascade;
drop table if exists public.cards cascade;
drop table if exists public.layouts cascade;
drop table if exists public.tags cascade;
drop table if exists public.users cascade;

create table public.users (
  id text primary key,
  name text not null,
  username text not null unique,
  email text,
  avatarurl text,
  passwordhash text,
  createdat timestamptz not null default now()
);

create table public.layouts (
  id text primary key,
  name text not null,
  imageurl text,
  createdat timestamptz not null default now()
);

create table public.cards (
  id text primary key default gen_random_uuid()::text,
  secretcode text,
  uid text unique,
  assignedlocationid text,
  assigneduserid text references public.users(id) on delete set null,
  assignedtaskid text,
  alias text,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('pending', 'active', 'lost', 'revoked', 'damaged')),
  security_mode text not null default 'static_uid'
    check (security_mode in ('static_uid', 'static_ndef', 'rolling_token', 'ntag424_sun', 'desfire', 'mifare_ultralight_aes')),
  ndef_payload text,
  read_counter bigint not null default 0,
  lastscannedat timestamptz,
  lastverifiedat timestamptz,
  active boolean not null default true,
  createdat timestamptz not null default now()
);

create table public.locations (
  id text primary key,
  name text not null,
  layoutid text not null references public.layouts(id) on delete cascade,
  nfccardid text references public.cards(id) on delete set null,
  x integer not null check (x >= 0 and x <= 100),
  y integer not null check (y >= 0 and y <= 100),
  createdat timestamptz not null default now()
);

alter table public.cards
  add constraint cards_assignedlocationid_fkey
  foreign key (assignedlocationid)
  references public.locations(id)
  on delete set null;

create table public.tasks (
  id text primary key,
  title text not null,
  description text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'canceled')),
  locationid text references public.locations(id) on delete set null,
  userid text references public.users(id) on delete set null,
  createdat timestamptz not null default now(),
  duedate timestamptz,
  nextdueat timestamptz,
  lastcompletedat timestamptz,
  completionnotes text,
  repeat_frequency integer check (repeat_frequency is null or repeat_frequency > 0),
  repeat_unit text check (repeat_unit is null or repeat_unit in ('hours', 'days')),
  active boolean not null default true
);

alter table public.cards
  add constraint cards_assignedtaskid_fkey
  foreign key (assignedtaskid)
  references public.tasks(id)
  on delete set null;

create table public.attachments (
  id text primary key,
  taskid text not null references public.tasks(id) on delete cascade,
  name text not null,
  type text not null,
  size integer not null default 0,
  url text not null,
  createdat timestamptz not null default now()
);

create table public.task_logs (
  id uuid primary key default gen_random_uuid(),
  taskid text not null references public.tasks(id) on delete cascade,
  status text not null,
  notes text,
  completedat timestamptz,
  createdat timestamptz not null default now(),
  createdby text references public.users(id) on delete set null
);

create table public.card_events (
  id uuid primary key default gen_random_uuid(),
  cardid text references public.cards(id) on delete set null,
  event_type text not null,
  userid text references public.users(id) on delete set null,
  locationid text references public.locations(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  createdat timestamptz not null default now()
);

create table public.nfc_scan_events (
  id uuid primary key default gen_random_uuid(),
  cardid text references public.cards(id) on delete set null,
  uid text,
  secretcode_hash text,
  userid text references public.users(id) on delete set null,
  locationid text references public.locations(id) on delete set null,
  result text not null check (result in ('matched', 'no_card', 'inactive_card', 'no_location', 'no_task', 'security_failed')),
  details jsonb not null default '{}'::jsonb,
  createdat timestamptz not null default now()
);

create table public.task_completion_events (
  id uuid primary key default gen_random_uuid(),
  taskid text not null references public.tasks(id) on delete cascade,
  cardid text references public.cards(id) on delete set null,
  userid text references public.users(id) on delete set null,
  locationid text references public.locations(id) on delete set null,
  notes text,
  source text not null default 'nfc',
  createdat timestamptz not null default now()
);

create table public.tags (
  id text primary key,
  name text not null unique,
  color text,
  createdat timestamptz not null default now()
);

create table public.task_tags (
  taskid text not null references public.tasks(id) on delete cascade,
  tagid text not null references public.tags(id) on delete cascade,
  primary key (taskid, tagid)
);

create index tasks_status_idx on public.tasks(status);
create index tasks_locationid_idx on public.tasks(locationid);
create index tasks_userid_idx on public.tasks(userid);
create index tasks_duedate_idx on public.tasks(duedate);
create index locations_layoutid_idx on public.locations(layoutid);
create index cards_uid_idx on public.cards(uid);
create index cards_assignedlocationid_idx on public.cards(assignedlocationid);
create index cards_lifecycle_status_idx on public.cards(lifecycle_status);
create index nfc_scan_events_cardid_idx on public.nfc_scan_events(cardid);
create index nfc_scan_events_createdat_idx on public.nfc_scan_events(createdat);
create index task_completion_events_taskid_idx on public.task_completion_events(taskid);
create index task_logs_taskid_idx on public.task_logs(taskid);
create index task_tags_tagid_idx on public.task_tags(tagid);

insert into public.users (id, name, username, email, avatarurl, passwordhash)
values
  ('u1', 'Ahmet Yilmaz', 'ahmet', 'ahmet@example.com', 'https://picsum.photos/seed/u1/100/100', '123456'),
  ('u2', 'Ayse Kaya', 'ayse', 'ayse@example.com', 'https://picsum.photos/seed/u2/100/100', '123456'),
  ('u3', 'Mehmet Ozturk', 'mehmet', 'mehmet@example.com', 'https://picsum.photos/seed/u3/100/100', '123456');

insert into public.layouts (id, name, imageurl)
values
  ('layout1', 'Zemin Kat - Uretim Alani', 'layout1.jpg'),
  ('layout2', 'Depo ve Lojistik Alani', 'layout2.jpg');

-- Cards are inserted before locations with assignedlocationid empty to avoid the
-- circular cards <-> locations foreign key issue. The assignment is updated later.
insert into public.cards (id, secretcode, uid, assignedlocationid, assigneduserid, assignedtaskid, alias, lifecycle_status, security_mode, ndef_payload, active)
values
  ('NFC001', 'a1b2c3d4', '04:6a:9c:8d:a8:67:80', null, 'u1', null, 'Giris Karti', 'active', 'static_uid', 'a1b2c3d4', true),
  ('NFC002', 'e5f6g7h8', '04:6a:9c:8d:a8:67:81', null, 'u2', null, 'CNC Karti', 'active', 'static_uid', 'e5f6g7h8', true),
  ('NFC003', 'i9j0k1l2', '04:6a:9c:8d:a8:67:82', null, 'u3', null, 'Kalite Karti', 'active', 'static_uid', 'i9j0k1l2', true),
  ('NFC004', 'm3n4o5p6', '04:6a:9c:8d:a8:67:83', null, null, null, 'Yedek Kart 1', 'pending', 'static_uid', 'm3n4o5p6', true),
  ('NFC005', 'q7r8s9t0', '04:6a:9c:8d:a8:67:84', null, null, null, 'Yedek Kart 2', 'pending', 'static_uid', 'q7r8s9t0', true);

insert into public.locations (id, name, layoutid, nfccardid, x, y)
values
  ('loc1', 'Ana Giris Guvenlik Noktasi', 'layout1', 'NFC001', 15, 25),
  ('loc2', 'CNC Makinesi #3', 'layout1', 'NFC002', 50, 50),
  ('loc3', 'Kalite Kontrol Masasi', 'layout2', 'NFC003', 80, 70),
  ('loc4', 'Sevkiyat Kapisi', 'layout2', null, 35, 45);

update public.cards set assignedlocationid = 'loc1' where id = 'NFC001';
update public.cards set assignedlocationid = 'loc2' where id = 'NFC002';
update public.cards set assignedlocationid = 'loc3' where id = 'NFC003';

insert into public.tasks (
  id,
  title,
  description,
  status,
  locationid,
  userid,
  createdat,
  duedate,
  nextdueat,
  lastcompletedat,
  completionnotes,
  repeat_frequency,
  repeat_unit,
  active
)
values
  (
    't1',
    'Giris kapisi kontrolu',
    'Depo A giris kapisinin kilitli oldugundan emin ol.',
    'completed',
    'loc1',
    'u1',
    now() - interval '2 days',
    now() - interval '1 day',
    now() + interval '1 day',
    now() - interval '23 hours',
    'Kapi kilitliydi, sorun yok.',
    1,
    'days',
    true
  ),
  (
    't2',
    'Makine yagi seviyesi kontrolu',
    'Uretim hattindaki 2 numarali makinenin yag seviyesini kontrol et.',
    'in_progress',
    'loc2',
    'u2',
    now() - interval '2 hours',
    now() + interval '4 hours',
    now() + interval '1 day',
    null,
    null,
    1,
    'days',
    true
  ),
  (
    't3',
    'Mutfak temizligi',
    'Ofis mutfagindaki kahve makinesini temizle.',
    'not_started',
    'loc3',
    'u3',
    now() - interval '1 hour',
    now() + interval '8 hours',
    null,
    null,
    null,
    null,
    null,
    true
  ),
  (
    't4',
    'Depo raf kontrolu',
    'Depo raflarinda gevsek baglanti ve hasar kontrolu yap.',
    'not_started',
    'loc4',
    'u1',
    now() - interval '30 minutes',
    now() + interval '26 hours',
    null,
    null,
    null,
    null,
    null,
    true
  ),
  (
    't5',
    'Sevkiyat alani temizligi',
    'Sevkiyat kapisi cevresindeki palet ve ambalaj atiklarini kaldir.',
    'canceled',
    'loc4',
    'u2',
    now() - interval '3 days',
    now() - interval '2 days',
    null,
    null,
    'Vardiya plani degistigi icin iptal edildi.',
    null,
    null,
    false
  );

update public.cards set assignedtaskid = 't1' where id = 'NFC001';
update public.cards set assignedtaskid = 't2' where id = 'NFC002';
update public.cards set assignedtaskid = 't3' where id = 'NFC003';

insert into public.attachments (id, taskid, name, type, size, url)
values
  ('att1', 't1', 'giris-kapisi-foto.jpg', 'image/jpeg', 102400, 'https://picsum.photos/seed/door-check/800/600'),
  ('att2', 't2', 'makine-bakim-formu.pdf', 'application/pdf', 204800, 'https://example.com/demo/makine-bakim-formu.pdf');

insert into public.tags (id, name, color)
values
  ('tag-safety', 'Guvenlik', '#ef4444'),
  ('tag-maintenance', 'Bakim', '#3b82f6'),
  ('tag-cleaning', 'Temizlik', '#22c55e'),
  ('tag-logistics', 'Lojistik', '#f59e0b');

insert into public.task_tags (taskid, tagid)
values
  ('t1', 'tag-safety'),
  ('t2', 'tag-maintenance'),
  ('t3', 'tag-cleaning'),
  ('t4', 'tag-safety'),
  ('t4', 'tag-logistics'),
  ('t5', 'tag-cleaning'),
  ('t5', 'tag-logistics');

insert into public.card_events (cardid, event_type, userid, locationid, details)
values
  ('NFC001', 'assigned_to_location', 'u1', 'loc1', '{"seed": true}'::jsonb),
  ('NFC002', 'assigned_to_location', 'u2', 'loc2', '{"seed": true}'::jsonb),
  ('NFC003', 'assigned_to_location', 'u3', 'loc3', '{"seed": true}'::jsonb);

create or replace function public.verify_tag(tag_text text)
returns table (task_id text, allowed boolean)
language sql
security definer
set search_path = public
as $$
  select t.id as task_id, true as allowed
  from public.tasks t
  join public.locations l on l.id = t.locationid
  join public.cards c on c.id = l.nfccardid
  where t.active = true
    and t.status <> 'completed'
    and (
      c.uid = tag_text
      or c.id = tag_text
      or c.secretcode = tag_text
    )
  order by t.duedate nulls last, t.createdat
  limit 1;
$$;

revoke all on function public.verify_tag(text) from public;
grant execute on function public.verify_tag(text) to anon, authenticated;

create or replace function public.verify_nfc_scan(
  p_uid text,
  p_secretcode text default null,
  p_userid text default null
)
returns table (
  task_id text,
  title text,
  description text,
  status text,
  due_date timestamptz,
  location_id text,
  location_name text,
  card_id text,
  card_alias text,
  security_mode text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_card public.cards%rowtype;
  matched_location public.locations%rowtype;
  scan_result text;
begin
  select *
  into matched_card
  from public.cards c
  where (
    c.uid = p_uid
    or c.id = p_uid
    or (p_secretcode is not null and c.secretcode = p_secretcode)
    or (p_secretcode is not null and c.ndef_payload = p_secretcode)
  )
  order by c.createdat
  limit 1;

  if matched_card.id is null then
    insert into public.nfc_scan_events (uid, secretcode_hash, userid, result, details)
    values (p_uid, case when p_secretcode is null then null else encode(digest(p_secretcode, 'sha256'), 'hex') end, p_userid, 'no_card', '{}'::jsonb);
    return;
  end if;

  if matched_card.active is not true or matched_card.lifecycle_status <> 'active' then
    insert into public.nfc_scan_events (cardid, uid, secretcode_hash, userid, result, details)
    values (matched_card.id, p_uid, case when p_secretcode is null then null else encode(digest(p_secretcode, 'sha256'), 'hex') end, p_userid, 'inactive_card', '{}'::jsonb);
    return;
  end if;

  select *
  into matched_location
  from public.locations l
  where l.id = matched_card.assignedlocationid
     or l.nfccardid = matched_card.id
  limit 1;

  if matched_location.id is null then
    insert into public.nfc_scan_events (cardid, uid, secretcode_hash, userid, result, details)
    values (matched_card.id, p_uid, case when p_secretcode is null then null else encode(digest(p_secretcode, 'sha256'), 'hex') end, p_userid, 'no_location', '{}'::jsonb);
    return;
  end if;

  update public.cards
  set read_counter = read_counter + 1,
      lastscannedat = now(),
      lastverifiedat = now()
  where id = matched_card.id;

  if exists (
    select 1
    from public.tasks t
    where t.locationid = matched_location.id
      and (p_userid is null or t.userid = p_userid)
      and t.active = true
      and t.status not in ('completed', 'canceled')
  ) then
    scan_result := 'matched';
  else
    scan_result := 'no_task';
  end if;

  insert into public.nfc_scan_events (cardid, uid, secretcode_hash, userid, locationid, result, details)
  values (
    matched_card.id,
    p_uid,
    case when p_secretcode is null then null else encode(digest(p_secretcode, 'sha256'), 'hex') end,
    p_userid,
    matched_location.id,
    scan_result,
    jsonb_build_object('security_mode', matched_card.security_mode)
  );

  return query
  select
    t.id,
    t.title,
    t.description,
    t.status,
    t.duedate,
    matched_location.id,
    matched_location.name,
    matched_card.id,
    matched_card.alias,
    matched_card.security_mode
  from public.tasks t
  where t.locationid = matched_location.id
    and (p_userid is null or t.userid = p_userid)
    and t.active = true
    and t.status not in ('completed', 'canceled')
  order by t.duedate nulls last, t.createdat;
end;
$$;

create or replace function public.complete_task_from_nfc(
  p_task_id text,
  p_uid text,
  p_secretcode text default null,
  p_userid text default null,
  p_notes text default null
)
returns table (
  id text,
  title text,
  description text,
  status text,
  locationid text,
  userid text,
  createdat timestamptz,
  duedate timestamptz,
  nextdueat timestamptz,
  lastcompletedat timestamptz,
  completionnotes text,
  repeat_frequency integer,
  repeat_unit text,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_card public.cards%rowtype;
  matched_location public.locations%rowtype;
  target_task public.tasks%rowtype;
  now_value timestamptz := now();
  next_due timestamptz;
begin
  select *
  into matched_card
  from public.cards c
  where (
    c.uid = p_uid
    or c.id = p_uid
    or (p_secretcode is not null and c.secretcode = p_secretcode)
    or (p_secretcode is not null and c.ndef_payload = p_secretcode)
  )
  order by c.createdat
  limit 1;

  if matched_card.id is null then
    raise exception 'NFC card not found';
  end if;

  if matched_card.active is not true or matched_card.lifecycle_status <> 'active' then
    raise exception 'NFC card is not active';
  end if;

  select *
  into matched_location
  from public.locations l
  where l.id = matched_card.assignedlocationid
     or l.nfccardid = matched_card.id
  limit 1;

  if matched_location.id is null then
    raise exception 'NFC card is not assigned to a location';
  end if;

  select *
  into target_task
  from public.tasks t
  where t.id = p_task_id
    and t.locationid = matched_location.id
    and (p_userid is null or t.userid = p_userid)
    and t.active = true
    and t.status not in ('completed', 'canceled')
  for update;

  if target_task.id is null then
    raise exception 'No completable task matched this card, user, and location';
  end if;

  if target_task.repeat_frequency is not null and target_task.repeat_unit is not null then
    if target_task.repeat_unit = 'days' then
      next_due := coalesce(target_task.nextdueat, target_task.duedate, now_value) + make_interval(days => target_task.repeat_frequency);
    else
      next_due := coalesce(target_task.nextdueat, target_task.duedate, now_value) + make_interval(hours => target_task.repeat_frequency);
    end if;

    update public.tasks
    set status = 'not_started',
        lastcompletedat = now_value,
        completionnotes = p_notes,
        nextdueat = next_due,
        duedate = next_due,
        active = true
    where public.tasks.id = target_task.id;
  else
    update public.tasks
    set status = 'completed',
        lastcompletedat = now_value,
        completionnotes = p_notes,
        active = false
    where public.tasks.id = target_task.id;
  end if;

  update public.cards
  set read_counter = read_counter + 1,
      lastscannedat = now_value,
      lastverifiedat = now_value,
      assignedtaskid = target_task.id
  where public.cards.id = matched_card.id;

  insert into public.task_completion_events (taskid, cardid, userid, locationid, notes, source)
  values (target_task.id, matched_card.id, p_userid, matched_location.id, p_notes, 'nfc');

  insert into public.task_logs (taskid, status, notes, completedat, createdby)
  values (target_task.id, 'completed', p_notes, now_value, p_userid);

  insert into public.nfc_scan_events (cardid, uid, secretcode_hash, userid, locationid, result, details)
  values (
    matched_card.id,
    p_uid,
    case when p_secretcode is null then null else encode(digest(p_secretcode, 'sha256'), 'hex') end,
    p_userid,
    matched_location.id,
    'matched',
    jsonb_build_object('completed_task_id', target_task.id, 'security_mode', matched_card.security_mode)
  );

  return query
  select
    t.id,
    t.title,
    t.description,
    t.status,
    t.locationid,
    t.userid,
    t.createdat,
    t.duedate,
    t.nextdueat,
    t.lastcompletedat,
    t.completionnotes,
    t.repeat_frequency,
    t.repeat_unit,
    t.active
  from public.tasks t
  where t.id = target_task.id;
end;
$$;

revoke all on function public.verify_nfc_scan(text, text, text) from public;
revoke all on function public.complete_task_from_nfc(text, text, text, text, text) from public;
grant execute on function public.verify_nfc_scan(text, text, text) to anon, authenticated;
grant execute on function public.complete_task_from_nfc(text, text, text, text, text) to anon, authenticated;

do $$
declare
  r record;
  policy_name text;
begin
  for r in
    select unnest(array[
      'users',
      'layouts',
      'cards',
      'locations',
      'tasks',
      'task_logs',
      'card_events',
      'nfc_scan_events',
      'task_completion_events',
      'attachments',
      'tags',
      'task_tags'
    ]) as table_name
  loop
    execute format('alter table public.%I enable row level security', r.table_name);

    policy_name := r.table_name || '_anon_select';
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', policy_name, r.table_name);

    policy_name := r.table_name || '_anon_insert';
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (true)', policy_name, r.table_name);

    policy_name := r.table_name || '_anon_update';
    execute format('create policy %I on public.%I for update to anon, authenticated using (true) with check (true)', policy_name, r.table_name);

    policy_name := r.table_name || '_anon_delete';
    execute format('create policy %I on public.%I for delete to anon, authenticated using (true)', policy_name, r.table_name);
  end loop;
end $$;

commit;
