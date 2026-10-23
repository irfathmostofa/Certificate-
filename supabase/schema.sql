-- Certify Studio — Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query.
-- It creates the tables, row level security policies and the storage bucket
-- used by the application.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.settings (
  id integer primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.settings (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

create table if not exists public.templates (
  id text primary key,
  name text not null,
  category text not null default 'Custom',
  description text default '',
  design jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id text primary key,
  certificate_id text unique not null,
  public_token text unique,
  recipient_name text not null,
  recipient_email text default '',
  course_title text not null,
  description text default '',
  template_id text,
  design jsonb,
  organization jsonb,
  signature jsonb,
  issue_date text,
  status text not null default 'issued',
  created_at timestamptz not null default now()
);

-- Add columns when upgrading an existing database.
alter table public.certificates
  add column if not exists public_token text unique,
  add column if not exists organization jsonb,
  add column if not exists signature jsonb,
  add column if not exists recipient_email text default '';

create index if not exists certificates_created_at_idx
  on public.certificates (created_at desc);

create index if not exists certificates_recipient_idx
  on public.certificates (lower(recipient_name));

-- ---------------------------------------------------------------------------
-- Row level security
-- Only authenticated users (admins) can read/write.
-- ---------------------------------------------------------------------------

alter table public.settings enable row level security;
alter table public.templates enable row level security;
alter table public.certificates enable row level security;

drop policy if exists "settings for authenticated" on public.settings;
create policy "settings for authenticated" on public.settings
  for all to authenticated using (true) with check (true);

drop policy if exists "templates for authenticated" on public.templates;
create policy "templates for authenticated" on public.templates
  for all to authenticated using (true) with check (true);

drop policy if exists "certificates for authenticated" on public.certificates;
create policy "certificates for authenticated" on public.certificates
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Public certificate lookup
-- Anonymous visitors can view a single certificate through this function,
-- without being able to list or read the certificates table directly.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_certificate(p_token text)
returns table (
  id text,
  certificate_id text,
  public_token text,
  recipient_name text,
  recipient_email text,
  course_title text,
  description text,
  template_id text,
  design jsonb,
  organization jsonb,
  signature jsonb,
  issue_date text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select id, certificate_id, public_token, recipient_name, recipient_email, course_title,
         description, template_id, design, organization, signature,
         issue_date, status, created_at
  from public.certificates
  where public_token = p_token or certificate_id = p_token
  limit 1;
$$;

revoke all on function public.get_public_certificate(text) from public;
grant execute on function public.get_public_certificate(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for logos and signature images
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('certify-assets', 'certify-assets', true)
on conflict (id) do nothing;

drop policy if exists "certify assets public read" on storage.objects;
create policy "certify assets public read" on storage.objects
  for select to public using (bucket_id = 'certify-assets');

drop policy if exists "certify assets authenticated write" on storage.objects;
create policy "certify assets authenticated write" on storage.objects
  for insert to authenticated with check (bucket_id = 'certify-assets');

drop policy if exists "certify assets authenticated update" on storage.objects;
create policy "certify assets authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'certify-assets');
