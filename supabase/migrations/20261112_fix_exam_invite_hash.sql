-- Fix exam invitation lookup. Accept either the raw token or the client SHA-256
-- hash so links stay valid even when pgcrypto digest() is missing from search_path.

create extension if not exists pgcrypto;

create or replace function public.find_exam_invitation(p_token text)
returns public.exam_invitations
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  inv public.exam_invitations%rowtype;
  h text;
  t text := btrim(coalesce(p_token, ''));
begin
  if t = '' then
    return inv;
  end if;

  select * into inv from public.exam_invitations where token_hash = t;
  if found then
    return inv;
  end if;

  begin
    h := encode(extensions.digest(convert_to(t, 'UTF8'), 'sha256'), 'hex');
  exception when others then
    begin
      h := encode(digest(convert_to(t, 'UTF8'), 'sha256'), 'hex');
    exception when others then
      return inv;
    end;
  end;

  if h is not null and h <> t then
    select * into inv from public.exam_invitations where token_hash = h;
  end if;
  return inv;
end;
$$;

create or replace function public.peek_exam_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  inv public.exam_invitations%rowtype;
  ex public.examinations%rowtype;
  att public.exam_attempts%rowtype;
  display_count integer;
begin
  inv := public.find_exam_invitation(p_token);
  if inv.id is null then
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
    'attemptStatus', case when inv.status = 'unused' then null else att.status end,
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
set search_path = public, extensions, pg_temp
as $$
declare
  inv public.exam_invitations%rowtype;
  ex public.examinations%rowtype;
  selected jsonb := '[]'::jsonb;
  out_questions jsonb := '[]'::jsonb;
  attempt_id text;
  started timestamptz := now();
  ends timestamptz;
  display_count integer;
begin
  inv := public.find_exam_invitation(p_token);
  if inv.id is null then
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
set search_path = public, extensions, pg_temp
as $$
declare
  inv public.exam_invitations%rowtype;
begin
  inv := public.find_exam_invitation(p_token);
  if inv.id is null then
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
set search_path = public, extensions, pg_temp
as $$
declare
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
  inv := public.find_exam_invitation(p_token);
  if inv.id is null then
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
set search_path = public, extensions, pg_temp
as $$
declare
  inv public.exam_invitations%rowtype;
begin
  inv := public.find_exam_invitation(p_token);
  if inv.id is null then
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

revoke all on function public.find_exam_invitation(text) from public;
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
