-- Noise Floor / Supabase setup
-- Run this in Supabase SQL Editor.
-- Then create one admin user in Authentication > Users.

create extension if not exists pgcrypto;

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text default '',
  icon text default '∿',
  url text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9_-]+$'),
  destination text not null default '/',
  label text default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.traffic_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  code text,
  event_type text not null check (event_type in ('visit','qr_scan','link_click')),
  path text,
  referrer text,
  timezone text,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);

alter table public.links enable row level security;
alter table public.campaigns enable row level security;
alter table public.traffic_events enable row level security;
alter table public.site_settings enable row level security;

-- Public site may read active links, enabled routes, and music setting.
drop policy if exists "public read active links" on public.links;
create policy "public read active links" on public.links for select to anon, authenticated
  using (enabled = true);

drop policy if exists "public read enabled campaigns" on public.campaigns;
create policy "public read enabled campaigns" on public.campaigns for select to anon, authenticated
  using (enabled = true);

drop policy if exists "public read music setting" on public.site_settings;
create policy "public read music setting" on public.site_settings for select to anon, authenticated
  using (key = 'music_url');

-- Visitors can insert analytics, but cannot read it.
drop policy if exists "public insert traffic" on public.traffic_events;
create policy "public insert traffic" on public.traffic_events for insert to anon, authenticated
  with check (event_type in ('visit','qr_scan','link_click'));

-- Admin = any authenticated user. Keep this account limited to club admins.
drop policy if exists "admin manage links" on public.links;
create policy "admin manage links" on public.links for all to authenticated using (true) with check (true);

drop policy if exists "admin manage campaigns" on public.campaigns;
create policy "admin manage campaigns" on public.campaigns for all to authenticated using (true) with check (true);

drop policy if exists "admin read traffic" on public.traffic_events;
create policy "admin read traffic" on public.traffic_events for select to authenticated using (true);

drop policy if exists "admin manage settings" on public.site_settings;
create policy "admin manage settings" on public.site_settings for all to authenticated using (true) with check (true);

grant select on public.links, public.campaigns, public.site_settings to anon, authenticated;
grant insert on public.traffic_events to anon, authenticated;
grant all on public.links, public.campaigns, public.site_settings, public.traffic_events to authenticated;

-- Seed links. Replace these URLs later in the admin panel.
insert into public.links (title,note,icon,url,sort_order)
values
('Instagram','follow the signal','IG','https://instagram.com/',10),
('Discord','talk shop / share builds','DS','https://discord.com/',20),
('QUT Club Hub','membership & events','Q','https://qutguild.com/',30),
('Email','noise.floor@qut.edu.au','@','mailto:noise.floor@qut.edu.au',40)
on conflict do nothing;

insert into public.site_settings(key,value)
values ('music_url','')
on conflict (key) do nothing;

-- Storage bucket for background music.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('music','music',true,26214400,array['audio/mpeg','audio/ogg','audio/wav','audio/mp4'])
on conflict (id) do nothing;

drop policy if exists "public read music files" on storage.objects;
create policy "public read music files" on storage.objects for select to anon, authenticated
  using (bucket_id = 'music');

drop policy if exists "admin upload music" on storage.objects;
create policy "admin upload music" on storage.objects for insert to authenticated
  with check (bucket_id = 'music');

drop policy if exists "admin update music" on storage.objects;
create policy "admin update music" on storage.objects for update to authenticated
  using (bucket_id = 'music') with check (bucket_id = 'music');

drop policy if exists "admin delete music" on storage.objects;
create policy "admin delete music" on storage.objects for delete to authenticated
  using (bucket_id = 'music');

-- Useful indexes for the dashboard.
create index if not exists traffic_events_created_at_idx on public.traffic_events(created_at desc);
create index if not exists traffic_events_code_idx on public.traffic_events(code);
create index if not exists traffic_events_visitor_id_idx on public.traffic_events(visitor_id);
