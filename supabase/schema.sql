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

create index if not exists certificates_recipient_email_idx
  on public.certificates (lower(recipient_email));

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

-- Examinations, one-time invitations and scored attempts.

create extension if not exists pgcrypto;

create table if not exists public.examinations (
  id text primary key,
  title text not null,
  description text default '',
  course_title text not null,
  total_marks numeric not null default 0,
  marks_per_question numeric not null default 1,
  pass_marks numeric not null default 0,
  duration_minutes integer not null default 30,
  negative_marking boolean not null default false,
  negative_marks numeric not null default 0,
  questions_to_display integer not null default 0,
  randomize boolean not null default true,
  active boolean not null default true,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_invitations (
  id text primary key,
  exam_id text not null references public.examinations(id) on delete cascade,
  student_name text not null,
  student_email text default '',
  token_hash text unique not null,
  status text not null default 'unused',
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.exam_attempts (
  id text primary key,
  invitation_id text not null references public.exam_invitations(id) on delete cascade,
  exam_id text not null references public.examinations(id) on delete cascade,
  student_name text,
  student_email text default '',
  status text not null default 'in_progress',
  question_ids jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  score numeric,
  passed boolean,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  submitted_at timestamptz,
  remaining_seconds integer,
  void_reason text default '',
  certificate_sent boolean not null default false,
  certificate_id text default ''
);

create index if not exists examinations_created_at_idx on public.examinations (created_at desc);
create index if not exists exam_invitations_exam_id_idx on public.exam_invitations (exam_id);
create index if not exists exam_invitations_hash_idx on public.exam_invitations (token_hash);
create index if not exists exam_attempts_exam_id_idx on public.exam_attempts (exam_id);
create index if not exists exam_attempts_invitation_id_idx on public.exam_attempts (invitation_id);

alter table public.examinations enable row level security;
alter table public.exam_invitations enable row level security;
alter table public.exam_attempts enable row level security;

drop policy if exists "examinations for authenticated" on public.examinations;
create policy "examinations for authenticated" on public.examinations
  for all to authenticated using (true) with check (true);

drop policy if exists "exam invitations for authenticated" on public.exam_invitations;
create policy "exam invitations for authenticated" on public.exam_invitations
  for all to authenticated using (true) with check (true);

drop policy if exists "exam attempts for authenticated" on public.exam_attempts;
create policy "exam attempts for authenticated" on public.exam_attempts
  for all to authenticated using (true) with check (true);

create or replace function public.peek_exam_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
  inv public.exam_invitations%rowtype;
  ex public.examinations%rowtype;
  att public.exam_attempts%rowtype;
  display_count integer;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  h := encode(digest(p_token, 'sha256'), 'hex');
  select * into inv from public.exam_invitations where token_hash = h;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into ex from public.examinations where id = inv.exam_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into att from public.exam_attempts where invitation_id = inv.id order by started_at desc limit 1;
  display_count := case
    when ex.questions_to_display > 0 then least(ex.questions_to_display, jsonb_array_length(ex.questions))
    else jsonb_array_length(ex.questions)
  end;
  return jsonb_build_object(
    'ok', true,
    'status', inv.status,
    'studentName', inv.student_name,
    'studentEmail', inv.student_email,
    'attemptStatus', att.status,
    'exam', jsonb_build_object(
      'id', ex.id,
      'title', ex.title,
      'description', ex.description,
      'courseTitle', ex.course_title,
      'durationMinutes', ex.duration_minutes,
      'totalMarks', ex.total_marks,
      'passMarks', ex.pass_marks,
      'negativeMarking', ex.negative_marking,
      'questionsToDisplay', display_count,
      'active', ex.active
    )
  );
end;
$$;

create or replace function public.start_exam_attempt(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
  inv public.exam_invitations%rowtype;
  ex public.examinations%rowtype;
  selected jsonb := '[]'::jsonb;
  out_questions jsonb := '[]'::jsonb;
  attempt_id text;
  started timestamptz := now();
  ends timestamptz;
  display_count integer;
begin
  h := encode(digest(p_token, 'sha256'), 'hex');
  select * into inv from public.exam_invitations where token_hash = h;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This examination link is invalid.');
  end if;
  if inv.status <> 'unused' then
    return jsonb_build_object('ok', false, 'error', 'This examination link is no longer available.');
  end if;
  select * into ex from public.examinations where id = inv.exam_id;
  if not found or ex.active is not true then
    return jsonb_build_object('ok', false, 'error', 'This examination is not available.');
  end if;
  if jsonb_array_length(ex.questions) = 0 then
    return jsonb_build_object('ok', false, 'error', 'This examination has no questions yet.');
  end if;

  display_count := case
    when ex.questions_to_display > 0 then least(ex.questions_to_display, jsonb_array_length(ex.questions))
    else jsonb_array_length(ex.questions)
  end;

  select coalesce(jsonb_agg(to_jsonb(qid) order by ord), '[]'::jsonb)
    into selected
    from (
      select q->>'id' as qid,
             case when ex.randomize then random() else ordinality::double precision end as ord
      from jsonb_array_elements(ex.questions) with ordinality as t(q, ordinality)
      order by ord
      limit display_count
    ) s;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.question->>'id',
      'text', q.question->>'text',
      'options', q.question->'options',
      'marks', q.question->'marks',
      'category', coalesce(q.question->>'category', '')
    ) order by pos
  ), '[]'::jsonb)
    into out_questions
    from jsonb_array_elements_text(selected) with ordinality as ids(qid, pos)
    join jsonb_array_elements(ex.questions) as q(question) on q.question->>'id' = ids.qid;

  attempt_id := gen_random_uuid()::text;
  ends := started + make_interval(mins => ex.duration_minutes);

  insert into public.exam_attempts (
    id, invitation_id, exam_id, student_name, student_email, status,
    question_ids, answers, started_at, ends_at, remaining_seconds
  ) values (
    attempt_id, inv.id, ex.id, inv.student_name, inv.student_email, 'in_progress',
    selected, '{}'::jsonb, started, ends, ex.duration_minutes * 60
  );

  update public.exam_invitations
    set status = 'used', used_at = started
    where id = inv.id;

  return jsonb_build_object(
    'ok', true,
    'attempt', jsonb_build_object(
      'id', attempt_id,
      'status', 'in_progress',
      'startedAt', started,
      'endsAt', ends,
      'studentName', inv.student_name,
      'studentEmail', inv.student_email,
      'questionIds', selected,
      'answers', '{}'::jsonb
    ),
    'exam', jsonb_build_object(
      'id', ex.id,
      'title', ex.title,
      'description', ex.description,
      'courseTitle', ex.course_title,
      'durationMinutes', ex.duration_minutes,
      'totalMarks', ex.total_marks,
      'passMarks', ex.pass_marks,
      'negativeMarking', ex.negative_marking,
      'questionsToDisplay', display_count,
      'active', ex.active
    ),
    'questions', out_questions
  );
end;
$$;

create or replace function public.save_exam_progress(p_token text, p_answers jsonb, p_remaining integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
  inv public.exam_invitations%rowtype;
begin
  h := encode(digest(p_token, 'sha256'), 'hex');
  select * into inv from public.exam_invitations where token_hash = h;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This examination link is invalid.');
  end if;
  update public.exam_attempts
    set answers = coalesce(p_answers, '{}'::jsonb),
        remaining_seconds = coalesce(p_remaining, remaining_seconds)
    where invitation_id = inv.id and status = 'in_progress';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'No active examination attempt was found.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.submit_exam_attempt(p_token text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
  inv public.exam_invitations%rowtype;
  ex public.examinations%rowtype;
  att public.exam_attempts%rowtype;
  q jsonb;
  qid text;
  chosen text;
  marks numeric;
  score numeric := 0;
  earned numeric;
  passed boolean;
begin
  h := encode(digest(p_token, 'sha256'), 'hex');
  select * into inv from public.exam_invitations where token_hash = h;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This examination link is invalid.');
  end if;
  select * into att from public.exam_attempts where invitation_id = inv.id order by started_at desc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'No examination attempt was found.');
  end if;
  if att.status = 'submitted' then
    return jsonb_build_object('ok', true, 'already', true, 'score', att.score, 'passed', att.passed);
  end if;
  if att.status <> 'in_progress' then
    return jsonb_build_object('ok', false, 'error', 'This examination can no longer be submitted.');
  end if;
  select * into ex from public.examinations where id = att.exam_id;

  for qid in select jsonb_array_elements_text(att.question_ids)
  loop
    select value into q
      from jsonb_array_elements(ex.questions) value
      where value->>'id' = qid
      limit 1;
    if q is null then
      continue;
    end if;
    marks := coalesce(nullif(q->>'marks', '')::numeric, ex.marks_per_question);
    chosen := coalesce(p_answers->>qid, '');
    if chosen = '' then
      earned := 0;
    elsif chosen = coalesce(q->>'correctOptionId', '') then
      earned := marks;
    elsif ex.negative_marking then
      earned := -ex.negative_marks;
    else
      earned := 0;
    end if;
    score := score + earned;
  end loop;

  passed := score >= ex.pass_marks;

  update public.exam_attempts
    set answers = coalesce(p_answers, '{}'::jsonb),
        status = 'submitted',
        score = score,
        passed = passed,
        submitted_at = now(),
        remaining_seconds = 0
    where id = att.id;

  return jsonb_build_object(
    'ok', true,
    'score', score,
    'passed', passed,
    'totalMarks', ex.total_marks,
    'passMarks', ex.pass_marks
  );
end;
$$;

create or replace function public.void_exam_attempt(p_token text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h text;
  inv public.exam_invitations%rowtype;
begin
  h := encode(digest(p_token, 'sha256'), 'hex');
  select * into inv from public.exam_invitations where token_hash = h;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update public.exam_attempts
    set status = 'voided',
        void_reason = coalesce(p_reason, 'left-exam'),
        submitted_at = now()
    where invitation_id = inv.id and status = 'in_progress';
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.peek_exam_invitation(text) from public;
revoke all on function public.start_exam_attempt(text) from public;
revoke all on function public.save_exam_progress(text, jsonb, integer) from public;
revoke all on function public.submit_exam_attempt(text, jsonb) from public;
revoke all on function public.void_exam_attempt(text, text) from public;

grant execute on function public.peek_exam_invitation(text) to anon, authenticated;
grant execute on function public.start_exam_attempt(text) to anon, authenticated;
grant execute on function public.save_exam_progress(text, jsonb, integer) to anon, authenticated;
grant execute on function public.submit_exam_attempt(text, jsonb) to anon, authenticated;
grant execute on function public.void_exam_attempt(text, text) to anon, authenticated;
