-- Full reset + seed for NFC Task Tracker Supabase project.
-- Run in Supabase Dashboard > SQL Editor.
--
-- WARNING: This deletes the existing app tables and demo RPC before recreating them.
-- The anon RLS policies below are intentionally permissive for a demo/internal prototype.
-- Tighten policies before exposing the project publicly.

begin;

create extension if not exists pgcrypto;

drop function if exists public.verify_tag(text);

drop table if exists public.task_tags cascade;
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
insert into public.cards (id, secretcode, uid, assignedlocationid, assigneduserid, assignedtaskid, alias, active)
values
  ('NFC001', 'a1b2c3d4', '04:6a:9c:8d:a8:67:80', null, 'u1', null, 'Giris Karti', true),
  ('NFC002', 'e5f6g7h8', '04:6a:9c:8d:a8:67:81', null, 'u2', null, 'CNC Karti', true),
  ('NFC003', 'i9j0k1l2', '04:6a:9c:8d:a8:67:82', null, 'u3', null, 'Kalite Karti', true),
  ('NFC004', 'm3n4o5p6', '04:6a:9c:8d:a8:67:83', null, null, null, 'Yedek Kart 1', true),
  ('NFC005', 'q7r8s9t0', '04:6a:9c:8d:a8:67:84', null, null, null, 'Yedek Kart 2', true);

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
