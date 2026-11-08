-- v103: Maestria por tópico + XP honesto (atividade + domínio)
-- Compatível com user_state JSONB existente. Não quebra ranking atual.

create table if not exists public.topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id text not null default 'default',
  subject_key text not null,
  topic_key text not null,
  attempts int not null default 0 check (attempts >= 0),
  correct int not null default 0 check (correct >= 0),
  mastery numeric(5,2) not null default 0
    check (mastery >= 0 and mastery <= 100),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_id, subject_key, topic_key)
);

create index if not exists topic_mastery_user_campaign_idx
  on public.topic_mastery (user_id, campaign_id);
create index if not exists topic_mastery_user_mastery_idx
  on public.topic_mastery (user_id, mastery desc);

alter table public.topic_mastery enable row level security;

drop policy if exists "own_topic_mastery" on public.topic_mastery;
create policy "own_topic_mastery"
  on public.topic_mastery
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- RPC: registra resultado de questão e devolve XP + maestria
-- ============================================================
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
  uid uuid := auth.uid();
  row_mastery public.topic_mastery%rowtype;
  new_attempts int;
  new_correct int;
  new_mastery numeric(5,2);
  xp_gained int := 0;
  mastery_bonus int := 0;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  p_campaign_id := coalesce(nullif(trim(p_campaign_id), ''), 'default');
  p_subject_key := lower(trim(coalesce(p_subject_key, 'geral')));
  p_topic_key := lower(trim(coalesce(p_topic_key, 'geral')));

  insert into public.topic_mastery as tm
    (user_id, campaign_id, subject_key, topic_key, attempts, correct, mastery, last_attempt_at)
  values
    (uid, p_campaign_id, p_subject_key, p_topic_key,
     1, case when p_is_correct then 1 else 0 end,
     case when p_is_correct then 20.0 else 0.0 end,
     now())
  on conflict (user_id, campaign_id, subject_key, topic_key)
  do update set
    attempts = tm.attempts + 1,
    correct = tm.correct + case when p_is_correct then 1 else 0 end,
    last_attempt_at = now(),
    updated_at = now()
  returning * into row_mastery;

  new_attempts := row_mastery.attempts;
  new_correct := row_mastery.correct;

  if new_attempts < 5 then
    new_mastery := round((new_correct::numeric / greatest(new_attempts, 1)) * 100 * (new_attempts::numeric / 5), 2);
  else
    new_mastery := round((new_correct::numeric / new_attempts) * 100, 2);
  end if;

  update public.topic_mastery
    set mastery = new_mastery
  where id = row_mastery.id;

  if p_is_correct then
    xp_gained := 25;
  end if;

  if new_attempts >= 8 then
    if new_mastery >= 85 then
      mastery_bonus := 15;
    elsif new_mastery >= 70 then
      mastery_bonus := 8;
    end if;
  end if;

  return jsonb_build_object(
    'xp_gained', xp_gained,
    'mastery_bonus', mastery_bonus,
    'total_xp', xp_gained + mastery_bonus,
    'mastery', new_mastery,
    'attempts', new_attempts,
    'correct', new_correct,
    'subject_key', p_subject_key,
    'topic_key', p_topic_key,
    'source', p_source
  );
end;
$$;

revoke all on function public.record_question_attempt(text, text, text, boolean, text) from public, anon;
grant execute on function public.record_question_attempt(text, text, text, boolean, text) to authenticated;

-- ============================================================
-- RPC: finaliza missão com XP honesto (base + bônus de desempenho)
-- ============================================================
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
  uid uuid := auth.uid();
  score numeric;
  base_xp int := 40;
  performance_xp int := 0;
  mastery_bonus int := 0;
  boss_bonus int := 0;
  total_xp int;
  subject_avg numeric;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  p_total := greatest(p_total, 1);
  p_correct := greatest(least(p_correct, p_total), 0);
  score := round((p_correct::numeric / p_total) * 100, 1);

  performance_xp := least(60, floor(score * 0.6)::int);

  select coalesce(avg(mastery), 0) into subject_avg
    from public.topic_mastery
   where user_id = uid
     and campaign_id = coalesce(nullif(trim(p_campaign_id), ''), 'default')
     and subject_key = lower(trim(coalesce(p_subject_key, 'geral')))
     and attempts >= 5;

  if subject_avg >= 85 then
    mastery_bonus := 50;
  elsif subject_avg >= 70 then
    mastery_bonus := 30;
  elsif subject_avg >= 50 then
    mastery_bonus := 15;
  end if;

  if p_is_boss and score >= 70 then
    boss_bonus := 200;
  end if;

  total_xp := base_xp + performance_xp + mastery_bonus + boss_bonus;

  return jsonb_build_object(
    'base_xp', base_xp,
    'performance_xp', performance_xp,
    'mastery_bonus', mastery_bonus,
    'boss_bonus', boss_bonus,
    'total_xp', total_xp,
    'score', score,
    'subject_avg_mastery', round(subject_avg, 1)
  );
end;
$$;

revoke all on function public.complete_mission_honest(text, text, text, int, int, boolean) from public, anon;
grant execute on function public.complete_mission_honest(text, text, text, int, int, boolean) to authenticated;

create or replace view public.v_subject_mastery
with (security_invoker = true)
as
select
  user_id,
  campaign_id,
  subject_key,
  count(*) as topics,
  round(avg(mastery), 1) as avg_mastery,
  sum(attempts) as total_attempts,
  sum(correct) as total_correct
from public.topic_mastery
group by user_id, campaign_id, subject_key;

grant select on public.v_subject_mastery to authenticated;

-- 4. Correção automática no banco de siglas de mnemônicos geradas incorretamente pela IA (ex.: SOCIDDAPRF -> SO-CI-DI-VA-PLU)
update public.generated_study_content
set content = regexp_replace(content::text, 'SOCID(?:DAPRF|IVAP|IVA|DAPR|APRF)', 'SO-CI-DI-VA-PLU', 'gi')::jsonb
where content::text ~* 'SOCID(?:DAPRF|IVAP|IVA|DAPR|APRF)';
