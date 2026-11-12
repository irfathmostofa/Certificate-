-- Fix "column reference score is ambiguous" in submit_exam_attempt.
-- PL/pgSQL variables named score/passed collided with exam_attempts columns.

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
  v_score numeric := 0;
  earned numeric;
  v_passed boolean;
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
    v_score := v_score + earned;
  end loop;

  v_passed := v_score >= ex.pass_marks;

  update public.exam_attempts
    set answers = coalesce(p_answers, '{}'::jsonb),
        status = 'submitted',
        score = v_score,
        passed = v_passed,
        submitted_at = now(),
        remaining_seconds = 0
    where id = att.id;

  return jsonb_build_object(
    'ok', true,
    'score', v_score,
    'passed', v_passed,
    'totalMarks', ex.total_marks,
    'passMarks', ex.pass_marks
  );
end;
$$;
