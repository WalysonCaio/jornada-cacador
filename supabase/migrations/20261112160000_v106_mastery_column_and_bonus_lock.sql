-- r172: compatibilidade com a coluna criada na v103; preserva biblioteca e suas políticas.
BEGIN;
create or replace function public.record_question_attempt(
  p_campaign_id text,
  p_subject_key text,
  p_topic_key text,
  p_is_correct boolean,
  p_source text default 'practice'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempts int;
  v_correct int;
  v_mastery numeric(5,2);
  v_prev_70 boolean := false;
  v_prev_85 boolean := false;
  v_new_70 boolean := false;
  v_new_85 boolean := false;
  v_xp_delta int := 0;
  v_mastery_bonus int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if coalesce(trim(p_subject_key), '') = '' or coalesce(trim(p_topic_key), '') = '' then
    raise exception 'invalid_topic_or_subject';
  end if;

  -- Serializa atualização e leitura dos bônus para o mesmo tópico.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || '|' || coalesce(nullif(trim(p_campaign_id), ''), 'default') || '|' || lower(trim(p_subject_key)) || '|' || lower(trim(p_topic_key)), 0));

  select coalesce(tm.bonus_70_paid, false), coalesce(tm.bonus_85_paid, false)
    into v_prev_70, v_prev_85
  from public.topic_mastery tm
  where tm.user_id = v_uid
    and tm.campaign_id = coalesce(nullif(trim(p_campaign_id), ''), 'default')
    and tm.subject_key = lower(trim(p_subject_key))
    and tm.topic_key = lower(trim(p_topic_key));

  insert into public.topic_mastery (
    user_id, campaign_id, subject_key, topic_key,
    attempts, correct, last_attempt_at, updated_at
  )
  values (
    v_uid,
    coalesce(nullif(trim(p_campaign_id), ''), 'default'),
    lower(trim(p_subject_key)),
    lower(trim(p_topic_key)),
    1,
    case when p_is_correct then 1 else 0 end,
    now(),
    now()
  )
  on conflict (user_id, campaign_id, subject_key, topic_key)
  do update set
    attempts = public.topic_mastery.attempts + 1,
    correct = public.topic_mastery.correct + (case when p_is_correct then 1 else 0 end),
    last_attempt_at = now(),
    updated_at = now()
  returning attempts, correct into v_attempts, v_correct;

  if v_attempts < 5 then
    v_mastery := round(((v_correct::numeric / greatest(1, v_attempts)) * 100.0) * (v_attempts::numeric / 5.0), 2);
  else
    v_mastery := round((v_correct::numeric / greatest(1, v_attempts)) * 100.0, 2);
  end if;

  v_prev_70 := coalesce(v_prev_70, false);
  v_prev_85 := coalesce(v_prev_85, false);
  v_new_70 := v_prev_70;
  v_new_85 := v_prev_85;

  if p_is_correct then
    v_xp_delta := 10;
    if v_attempts >= 8 then
      if v_mastery >= 85 and not v_prev_85 then
        v_mastery_bonus := 15;
        v_new_85 := true;
        v_new_70 := true;
      elsif v_mastery >= 70 and not v_prev_70 then
        v_mastery_bonus := 8;
        v_new_70 := true;
      end if;
    end if;
  else
    v_xp_delta := 2;
  end if;

  update public.topic_mastery
     set mastery = v_mastery,
         bonus_70_paid = v_new_70,
         bonus_85_paid = v_new_85
   where user_id = v_uid
     and campaign_id = coalesce(nullif(trim(p_campaign_id), ''), 'default')
     and subject_key = lower(trim(p_subject_key))
     and topic_key = lower(trim(p_topic_key));

  return jsonb_build_object(
    'attempts', v_attempts,
    'correct', v_correct,
    'mastery', v_mastery,
    'xp_awarded', v_xp_delta + v_mastery_bonus,
    'xp_gained', v_xp_delta,
    'total_xp', v_xp_delta + v_mastery_bonus,
    'mastery_bonus', v_mastery_bonus,
    'bonus_70_paid', v_new_70,
    'bonus_85_paid', v_new_85,
    'source', coalesce(p_source, 'practice')
  );
end;
$$;

revoke all on function public.record_question_attempt(text, text, text, boolean, text) from public, anon;
grant execute on function public.record_question_attempt(text, text, text, boolean, text) to authenticated, service_role;

create or replace function public.complete_mission_honest(
  p_campaign_id text,
  p_mission_id text,
  p_subject_key text,
  p_correct int,
  p_total int,
  p_is_boss boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_safe_total int := greatest(0, coalesce(p_total, 0));
  v_safe_correct int := greatest(0, least(greatest(0, coalesce(p_total, 0)), coalesce(p_correct, 0)));
  v_score numeric(5,2) := 0;
  v_base_xp int := 40;
  v_perf_xp int := 0;
  v_mastery_avg numeric(5,2) := 0;
  v_mastery_bonus int := 0;
  v_boss_bonus int := 0;
  v_total_xp int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_safe_total > 0 then
    v_score := round((v_safe_correct::numeric / v_safe_total::numeric) * 100.0, 2);
    v_perf_xp := least(60, floor(v_score * 0.6)::int);
  end if;

  select coalesce(avg(tm.mastery), 0)
    into v_mastery_avg
  from public.topic_mastery tm
  where tm.user_id = v_uid
    and tm.campaign_id = coalesce(nullif(trim(p_campaign_id), ''), 'default')
    and tm.subject_key = lower(trim(coalesce(p_subject_key, 'geral')));

  if v_safe_total >= 5 and v_score >= 70 and v_mastery_avg >= 70 then
    v_mastery_bonus := 20;
  end if;

  if p_is_boss and v_safe_total >= 5 and v_score >= 70 then
    v_boss_bonus := 200;
  end if;

  v_total_xp := v_base_xp + v_perf_xp + v_mastery_bonus + v_boss_bonus;

  return jsonb_build_object(
    'mission_id', p_mission_id,
    'score', v_score,
    'questions_total', v_safe_total,
    'questions_correct', v_safe_correct,
    'base_xp', v_base_xp,
    'performance_xp', v_perf_xp,
    'mastery_avg', v_mastery_avg,
    'mastery_bonus', v_mastery_bonus,
    'boss_bonus', v_boss_bonus,
    'total_xp', v_total_xp
  );
end;
$$;

revoke all on function public.complete_mission_honest(text, text, text, int, int, boolean) from public, anon;
grant execute on function public.complete_mission_honest(text, text, text, int, int, boolean) to authenticated, service_role;

COMMIT;
