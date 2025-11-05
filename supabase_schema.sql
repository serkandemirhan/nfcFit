-- Supabase schema for NFC Task Tracker
-- Run this in Supabase SQL editor

create table if not exists users (
  id text primary key,
  name text not null,
  username text unique not null,
  email text,
  avatarUrl text not null,
  passwordHash text
);

create table if not exists layouts (
  id text primary key,
  name text not null,
  imageUrl text not null
);

create table if not exists cards (
  id text primary key,
  secretCode text not null,
  uid text,
  assignedLocationId text -- kept without FK to avoid circular constraints
);

create table if not exists locations (
  id text primary key,
  name text not null,
  layoutId text not null references layouts(id) on delete cascade,
  nfcCardId text references cards(id),
  x integer not null,
  y integer not null
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  description text not null,
  status text not null,
  locationId text not null references locations(id) on delete cascade,
  userId text not null references users(id) on delete cascade,
  createdAt timestamptz not null,
  dueDate timestamptz not null,
  nextDueAt timestamptz,
  lastCompletedAt timestamptz,
  completionNotes text,
  repeat_frequency integer,
  repeat_unit text,
  active boolean not null default true
);

create table if not exists task_logs (
  id uuid primary key default gen_random_uuid(),
  taskId text not null references tasks(id) on delete cascade,
  status text not null,
  notes text,
  completedAt timestamptz,
  createdAt timestamptz not null default now(),
  createdBy text references users(id)
);

create table if not exists attachments (
  id text primary key,
  taskId text not null references tasks(id) on delete cascade,
  name text not null,
  type text not null,
  size integer not null,
  url text not null
);

-- Seed data
insert into users (id, name, username, email, avatarUrl)
values
('u1','Ahmet Yılmaz','ahmet','ahmet@example.com','https://picsum.photos/seed/u1/100/100'),
('u2','Ayşe Kaya','ayse',null,'https://picsum.photos/seed/u2/100/100'),
('u3','Mehmet Öztürk','mehmet','mehmet@example.com','https://picsum.photos/seed/u3/100/100')
on conflict (id) do nothing;

insert into layouts (id, name, imageUrl)
values
('layout1','Zemin Kat - Üretim Alanı','layout1.jpg'),
('layout2','Depo ve Lojistik Alanı','layout2.jpg')
on conflict (id) do nothing;

insert into cards (id, secretCode, uid, assignedLocationId) values
('NFC001','a1b2c3d4','04:6a:9c:8d:a8:67:80','loc1'),
('NFC002','e5f6g7h8','04:6a:9c:8d:a8:67:81','loc2'),
('NFC003','i9j0k1l2','04:6a:9c:8d:a8:67:82','loc3'),
('NFC004','m3n4o5p6','04:6a:9c:8d:a8:67:83',null),
('NFC005','q7r8s9t0','04:6a:9c:8d:a8:67:84',null)
on conflict (id) do nothing;

insert into locations (id, name, layoutId, nfcCardId, x, y) values
('loc1','Ana Giriş Güvenlik Noktası','layout1','NFC001',15,25),
('loc2','CNC Makinesi #3','layout1','NFC002',50,50),
('loc3','Kalite Kontrol Masası','layout2','NFC003',80,70)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from tasks where id = 't1') then
    insert into tasks 
      (id, title, description, status, locationId, userId, createdAt, dueDate, nextDueAt, lastCompletedAt, completionNotes, repeat_frequency, repeat_unit, active)
    values
      (
        't1',
        'Giriş kapısı kontrolü',
        'Depo A giriş kapısının kilitli olduğundan emin ol.',
        'Devam Ediyor',
        'loc1',
        'u1',
        now() - interval '2 days',
        now() - interval '1 day',
        now() + interval '1 day',
        now() - interval '23 hours',
        'Kapı kilitliydi, sorun yok.',
        1,
        'days',
        true
      );
  end if;
  if not exists (select 1 from tasks where id = 't2') then
    insert into tasks (id,title,description,status,locationId,userId,createdAt,dueDate,nextDueAt,repeat_frequency,repeat_unit,active)
    values ('t2','Makine yağı seviyesi kontrolü','Üretim hattındaki 2 numaralı makinenin yağ seviyesini kontrol et.','Devam Ediyor','loc2','u2', now() - interval '2 hours', now() + interval '4 hours', now() + interval '4 hours', 1, 'days', true);
  end if;
  if not exists (select 1 from tasks where id = 't3') then
    insert into tasks (id,title,description,status,locationId,userId,createdAt,dueDate,nextDueAt,active)
    values ('t3','Mutfak temizliği','Ofis mutfağındaki kahve makinesini temizle.','Yapılacak','loc3','u3', now() - interval '1 hour', now() + interval '8 hours', null, true);
  end if;
end $$;
