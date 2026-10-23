-- Certify Studio — email migration
-- Run this in Supabase Dashboard -> SQL Editor if the database already exists.
-- Adds recipient_email to certificates and updates the public lookup function.

alter table public.certificates
  add column if not exists recipient_email text default '';

update public.certificates
set recipient_email = ''
where recipient_email is null;

create index if not exists certificates_recipient_email_idx
  on public.certificates (lower(recipient_email));

drop function if exists public.get_public_certificate(text);

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
