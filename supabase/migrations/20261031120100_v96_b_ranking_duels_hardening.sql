-- v96_b: ENDURECIMENTO DO RANKING, DA BIBLIOTECA COMUNITÁRIA E DOS DUELOS.
-- Execute depois da v96_a. Todas as funções são "create or replace" (idempotente).
--  1) Conversões seguras: um valor inválido em user_state.state (campo editável pelo usuário) quebrava o ranking de TODOS.
--  2) O ranking contava missões comparando com true, mas o app grava a data da conclusão: missões apareciam sempre como 0.
--  3) Nenhum nome público é mais derivado do e-mail; a biblioteca não mostra mais o nome real do autor.
--  4) Duelos: só participantes leem o duelo; o placar é recalculado no servidor; envio duplicado é recusado.

create or replace function public.safe_int(p_text text, p_min int default 0, p_max int default 1000000)
returns int
language sql
immutable
set search_path = public
as $$
  select case when p_text ~ '^-?[0-9]{1,9}$' then greatest(p_min, least(p_max, p_text::int)) else p_min end
$$;

create or replace function public.get_hunters_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  with raw_users as (
    select
      u.id as user_id,
      coalesce(us.state, '{}'::jsonb) as st,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'name'), ''),
        nullif(trim(us.state->'hunterStats'->>'name'), ''),
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), ''),
        'Caçador'
      ) as display_name,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'role'), ''),
        nullif(trim(us.state->'hunterStats'->>'role'), ''),
        camp_primary.name,
        nullif(trim(us.state->'customCampaign'->>'name'), ''),
        'PMPE — Soldado'
      ) as primary_role,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'secondaryRole'), ''),
        nullif(trim(us.state->'hunterStats'->>'secondaryRole'), ''),
        camp_secondary.name,
        state_secondary.name,
        ''
      ) as secondary_role,
      greatest(0, coalesce(public.safe_int(us.state->>'streak', 0, 3660), 0)) as streak,
      greatest(
        0,
        coalesce(public.safe_int(us.state->>'bestStreak', 0, 3660), 0),
        coalesce(public.safe_int(us.state->>'streak', 0, 3660), 0)
      ) as best_streak,
      coalesce(us.state->>'lastStudy', '') as last_study,
      coalesce(public.safe_int(us.state->'learning'->>'xp', 0, 1000000), 0) as learning_xp,
      (coalesce(us.state->'publicProfile'->>'hidden', '') in ('true', 't', '1')) as is_hidden,
      coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at, now()) as updated_at
    from auth.users u
    left join public.user_state us on us.user_id = u.id
    left join lateral (
      select sc.id, sc.name
      from public.study_campaigns sc
      where sc.user_id = u.id
      order by sc.priority asc nulls last, sc.is_active desc nulls last, sc.created_at asc
      limit 1
    ) camp_primary on true
    left join lateral (
      select sc2.name
      from public.study_campaigns sc2
      where sc2.user_id = u.id
        and (camp_primary.id is null or sc2.id <> camp_primary.id)
        and public.normalize_exam_slug(sc2.name, coalesce(sc2.organization, '')) <> public.normalize_exam_slug(coalesce(camp_primary.name, ''), '')
      order by sc2.priority asc nulls last, sc2.created_at asc
      limit 1
    ) camp_secondary on true
    left join lateral (
      select c_item->>'name' as name
      from jsonb_array_elements(
        case when jsonb_typeof(us.state->'campaigns') = 'array' then us.state->'campaigns' else '[]'::jsonb end
      ) as c_item
      where coalesce(c_item->>'name', '') <> ''
        and public.normalize_exam_slug(c_item->>'name', coalesce(c_item->>'organization', '')) <>
            public.normalize_exam_slug(
              coalesce(
                nullif(trim(us.state->'publicProfile'->>'role'), ''),
                camp_primary.name,
                'PMPE — Soldado'
              ),
              ''
            )
      order by coalesce(public.safe_int(c_item->>'priority', 0, 9), 2) asc
      limit 1
    ) state_secondary on true
  ),
  computed as (
    select
      ru.user_id,
      left(ru.display_name, 60) as name,
      public.normalize_hunter_name(ru.display_name) as norm_name,
      left(ru.primary_role, 80) as role,
      case
        when ru.secondary_role <> ''
         and public.normalize_exam_slug(ru.secondary_role, '') <> public.normalize_exam_slug(ru.primary_role, '')
          then left(ru.secondary_role, 80)
        else ''
      end as secondary_role,
      ru.streak,
      ru.best_streak,
      ru.last_study,
      ru.updated_at,
      coalesce(done_stats.done_count, 0) as missions_done,
      coalesce(boss_stats.boss_count, 0) as bosses_done,
      coalesce(score_stats.q_total, 0) as questions_total,
      coalesce(score_stats.q_correct, 0) as questions_correct,
      case
        when coalesce(score_stats.q_total, 0) > 0
          then least(100, round((score_stats.q_correct::numeric / score_stats.q_total::numeric) * 100)::int)
        else 0
      end as accuracy,
      greatest(
        coalesce(public.safe_int(ru.st->'hunterStats'->>'xp', 0, 1000000), 0),
        coalesce(done_stats.done_count, 0) * 100
        + coalesce(boss_stats.boss_count, 0) * 300
        + coalesce(score_stats.score_xp, 0)
        + ru.learning_xp
      ) as xp
    from raw_users ru
    left join lateral (
      select count(*)::int as done_count
      from jsonb_each(
        case when jsonb_typeof(ru.st->'done') = 'object' then ru.st->'done' else '{}'::jsonb end
      ) d
      where d.value not in ('false'::jsonb, 'null'::jsonb, '""'::jsonb, '0'::jsonb)
    ) done_stats on true
    left join lateral (
      select count(*)::int as boss_count
      from jsonb_each(
        case when jsonb_typeof(ru.st->'bosses') = 'object' then ru.st->'bosses' else '{}'::jsonb end
      ) b
      where b.value not in ('false'::jsonb, 'null'::jsonb, '""'::jsonb, '0'::jsonb)
    ) boss_stats on true
    left join lateral (
      select
        coalesce(sum(greatest(0, coalesce(public.safe_int(s.item->>'total', 0, 100000), 0))), 0)::int as q_total,
        coalesce(sum(greatest(0, coalesce(public.safe_int(s.item->>'correct', 0, 100000), 0))), 0)::int as q_correct,
        coalesce(
          sum(
            case
              when coalesce(public.safe_int(s.item->>'total', 0, 100000)::numeric, 0) > 0
                then least(40, floor((coalesce(public.safe_int(s.item->>'correct', 0, 100000)::numeric, 0) / public.safe_int(s.item->>'total', 0, 100000)::numeric) * 40))::int
              else 0
            end
          ),
          0
        )::int as score_xp
      from jsonb_array_elements(
        case when jsonb_typeof(ru.st->'scores') = 'array' then ru.st->'scores' else '[]'::jsonb end
      ) as s(item)
    ) score_stats on true
    where ru.is_hidden = false or ru.user_id = uid
  ),
  deduped as (
    select distinct on (c.norm_name)
      c.*
    from computed c
    order by
      c.norm_name,
      (c.user_id = uid) desc,
      c.xp desc,
      c.streak desc,
      c.missions_done desc,
      c.questions_total desc,
      c.updated_at desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', d.user_id,
        'is_me', (d.user_id = uid),
        'name', d.name,
        'role', d.role,
        'secondary_role', d.secondary_role,
        'streak', d.streak,
        'best_streak', d.best_streak,
        'last_study', d.last_study,
        'missions_done', d.missions_done,
        'questions_total', d.questions_total,
        'questions_correct', d.questions_correct,
        'accuracy', d.accuracy,
        'xp', d.xp,
        'updated_at', d.updated_at
      )
      order by d.streak desc, d.xp desc, d.accuracy desc, d.missions_done desc, d.name asc
    ),
    '[]'::jsonb
  )
  into result
  from deduped d;

  return result;
end;
$$;

revoke all on function public.get_hunters_leaderboard() from public;
grant execute on function public.get_hunters_leaderboard() to authenticated, service_role;

revoke all on function public.get_hunters_leaderboard() from public, anon;
grant execute on function public.get_hunters_leaderboard() to authenticated, service_role;

create or replace function public.get_duel_arena_hub()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_players jsonb;
  v_my_duels jsonb;
  v_recent_duels jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Atualiza presença online ao abrir/consultar a arena
  update public.user_state
     set server_updated_at = now()
   where user_id = uid;

  with raw_hunters as (
    select distinct on (public.normalize_hunter_name(
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'name'), ''),
        nullif(trim(us.state->'hunterStats'->>'name'), ''),
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), ''),
        'Caçador'
      )
    ))
      u.id as user_id,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'name'), ''),
        nullif(trim(us.state->'hunterStats'->>'name'), ''),
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), ''),
        'Caçador'
      ) as name,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'role'), ''),
        nullif(trim(us.state->'hunterStats'->>'role'), ''),
        'PMPE — Soldado'
      ) as role,
      greatest(0, coalesce(public.safe_int(us.state->'hunterStats'->>'xp', 0, 1000000), 0)) as xp,
      coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at, now()) as last_seen,
      (coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at, now()) > now() - interval '5 minutes') as is_online
    from auth.users u
    left join public.user_state us on us.user_id = u.id
    where not (coalesce(us.state->'publicProfile'->>'hidden', '') in ('true', 't', '1')) or u.id = uid
    order by
      public.normalize_hunter_name(
        coalesce(
          nullif(trim(us.state->'publicProfile'->>'name'), ''),
          nullif(trim(us.state->'hunterStats'->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          'Caçador'
        )
      ),
      (u.id = uid) desc,
      coalesce(public.safe_int(us.state->'hunterStats'->>'xp', 0, 1000000), 0) desc,
      coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at) desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', rh.user_id,
        'is_me', (rh.user_id = uid),
        'name', rh.name,
        'role', rh.role,
        'xp', rh.xp,
        'is_online', rh.is_online,
        'last_seen', rh.last_seen
      )
      order by rh.is_online desc, rh.name asc
    ),
    '[]'::jsonb
  )
  into v_players
  from raw_hunters rh;

  select coalesce(
    jsonb_agg(to_jsonb(d) order by d.created_at desc),
    '[]'::jsonb
  )
  into v_my_duels
  from (
    select *
    from public.hunter_duels hd
    where hd.challenger_id = uid or hd.opponent_id = uid
    order by hd.created_at desc
    limit 40
  ) d;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'challenger_id', d.challenger_id,
        'opponent_id', d.opponent_id,
        'challenger_name', d.challenger_name,
        'opponent_name', d.opponent_name,
        'subject', d.subject,
        'difficulty_mode', d.difficulty_mode,
        'challenger_score', d.challenger_score,
        'challenger_time_s', d.challenger_time_s,
        'opponent_score', d.opponent_score,
        'opponent_time_s', d.opponent_time_s,
        'winner_id', d.winner_id,
        'is_draw', d.is_draw,
        'status', d.status,
        'completed_at', d.completed_at,
        'created_at', d.created_at
      )
      order by coalesce(d.completed_at, d.created_at) desc
    ),
    '[]'::jsonb
  )
  into v_recent_duels
  from (
    select *
    from public.hunter_duels hd
    where hd.status = 'completed'
    order by hd.completed_at desc nulls last
    limit 80
  ) d;

  return jsonb_build_object(
    'players', v_players,
    'my_duels', v_my_duels,
    'completed_duels', v_recent_duels
  );
end;
$$;

revoke all on function public.get_duel_arena_hub() from public;
grant execute on function public.get_duel_arena_hub() to authenticated, service_role;

revoke all on function public.get_duel_arena_hub() from public, anon;
grant execute on function public.get_duel_arena_hub() to authenticated, service_role;

create or replace function public.get_community_exam_library(
  p_exam_name text,
  p_exam_org text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_slug text := public.normalize_exam_slug(p_exam_name, p_exam_org);
  v_docs jsonb;
  v_summaries jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Somente materiais de estudo, leis, provas, simulados e anotações (NUNCA 'edital' / 'edital_concurso')
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'campaign_id', d.campaign_id,
        'title', public.clean_standard_doc_title(d.title),
        'document_type', d.document_type,
        'detected_subject', d.detected_subject,
        'processing_status', 'ready',
        'page_count', d.page_count,
        'metadata', jsonb_build_object(
          'primary_subject', d.metadata->>'primary_subject',
          'coverage', d.metadata->'coverage'
        ),
        'created_at', d.created_at,
        'is_community', true,
        'exam_slug', v_slug,
        'portal_name', sc.name,
        'author_name', 'Colega de ' || upper(v_slug)
      )
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  into v_docs
  from public.study_documents d
  join public.study_campaigns sc on sc.id = d.campaign_id
  left join auth.users u on u.id = d.user_id
  where d.user_id <> uid
    and d.processing_status = 'ready'
    and d.document_type not in ('edital', 'edital_concurso')
    and public.normalize_exam_slug(sc.name, coalesce(sc.organization, '')) = v_slug;

  -- Conteúdos gerados (resumos, flashcards, questões, bizus) higienizados contra CPF/dados pessoais
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'source_document_id', g.source_document_id,
        'title', public.sanitize_personal_watermarks(g.title),
        'content', public.sanitize_generated_jsonb(g.content),
        'source_refs', g.source_refs,
        'created_at', g.created_at,
        'is_community', true,
        'exam_slug', v_slug
      )
      order by g.created_at asc
    ),
    '[]'::jsonb
  )
  into v_summaries
  from (
    select g.*
    from public.generated_study_content g
    join public.study_campaigns sc on sc.id = g.campaign_id
    left join public.study_documents sd on sd.id = g.source_document_id
    where g.user_id <> uid
      and g.content_type = 'summary'
      and (sd.id is null or sd.document_type not in ('edital', 'edital_concurso'))
      and public.normalize_exam_slug(sc.name, coalesce(sc.organization, '')) = v_slug
    order by g.created_at desc
    limit 250
  ) g;

  return jsonb_build_object(
    'exam_slug', v_slug,
    'documents', v_docs,
    'summaries', v_summaries,
    'edital_topics', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_community_exam_library(text, text) from public;
grant execute on function public.get_community_exam_library(text, text) to authenticated, service_role;

revoke all on function public.get_community_exam_library(text, text) from public, anon;
grant execute on function public.get_community_exam_library(text, text) to authenticated, service_role;

-- ───────────── Duelos ─────────────
drop policy if exists "Autenticados visualizam duelos da arena" on public.hunter_duels;
drop policy if exists "Participantes visualizam seus duelos" on public.hunter_duels;
create policy "Participantes visualizam seus duelos"
  on public.hunter_duels
  for select
  to authenticated
  using (auth.uid() in (challenger_id, opponent_id));

-- Escritas só pelas funções abaixo (o hub público usa get_duel_arena_hub, que não expõe as perguntas).
revoke insert, update, delete on public.hunter_duels from anon, authenticated;

create or replace function public.create_hunter_duel(
  p_opponent_id uuid,
  p_subject text,
  p_mode text,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_challenger_name text;
  v_opponent_name text;
  v_duel_id uuid;
  v_clean jsonb;
  v_pending int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_opponent_id is null or p_opponent_id = uid then
    raise exception 'invalid_opponent';
  end if;
  if not exists (select 1 from auth.users where id = p_opponent_id) then
    raise exception 'invalid_opponent';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 20 then
    raise exception 'invalid_questions';
  end if;

  select count(*)::int into v_pending
    from public.hunter_duels
   where challenger_id = uid and status = 'pending' and created_at > now() - interval '1 day';
  if v_pending >= 10 then
    raise exception 'too_many_pending_duels';
  end if;

  -- Mantém só os campos conhecidos, com tamanho limitado e índice de resposta válido.
  select jsonb_agg(jsonb_build_object(
           'subject', left(coalesce(q->>'subject', ''), 120),
           'topic', left(coalesce(q->>'topic', ''), 200),
           'statement', left(coalesce(q->>'statement', ''), 1500),
           'options', (
             select coalesce(jsonb_agg(left(o #>> '{}', 500)), '[]'::jsonb)
               from jsonb_array_elements(q->'options') o
           ),
           'correct_index', public.safe_int(q->>'correct_index', 0, 9),
           'explanation', left(coalesce(q->>'explanation', ''), 1500),
           'difficulty', left(coalesce(q->>'difficulty', ''), 20)
         ))
    into v_clean
    from jsonb_array_elements(p_questions) q
   where case when jsonb_typeof(q) = 'object' then coalesce(q->>'statement', '') <> '' else false end
     and case when jsonb_typeof(q) = 'object' and jsonb_typeof(q->'options') = 'array'
              then jsonb_array_length(q->'options') between 2 and 6
                   and public.safe_int(q->>'correct_index', 0, 9) < jsonb_array_length(q->'options')
              else false end;

  if v_clean is null or jsonb_array_length(v_clean) < 1 then
    raise exception 'invalid_questions';
  end if;

  select left(coalesce(
           nullif(trim(us.state->'publicProfile'->>'name'), ''),
           nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
           nullif(trim(u.raw_user_meta_data->>'name'), ''),
           'Caçador'), 60)
    into v_challenger_name
    from auth.users u
    left join public.user_state us on us.user_id = u.id
   where u.id = uid;

  select left(coalesce(
           nullif(trim(us.state->'publicProfile'->>'name'), ''),
           nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
           nullif(trim(u.raw_user_meta_data->>'name'), ''),
           'Oponente'), 60)
    into v_opponent_name
    from auth.users u
    left join public.user_state us on us.user_id = u.id
   where u.id = p_opponent_id;

  insert into public.hunter_duels (
    challenger_id, opponent_id, challenger_name, opponent_name,
    subject, difficulty_mode, questions, status
  )
  values (
    uid, p_opponent_id,
    coalesce(v_challenger_name, 'Caçador'), coalesce(v_opponent_name, 'Oponente'),
    left(coalesce(nullif(trim(p_subject), ''), 'Roleta Mista'), 120),
    left(coalesce(nullif(trim(p_mode), ''), 'misto'), 40),
    v_clean, 'pending'
  )
  returning id into v_duel_id;

  return jsonb_build_object('duel_id', v_duel_id, 'status', 'pending');
end;
$$;

revoke all on function public.create_hunter_duel(uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_hunter_duel(uuid, text, text, jsonb) to authenticated, service_role;

create or replace function public.submit_hunter_duel_round(
  p_duel_id uuid,
  p_score integer,
  p_time_s integer,
  p_answers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.hunter_duels%rowtype;
  v_n int;
  v_score int := 0;
  v_time int := 0;
  v_answered int := 0;
  v_winner uuid := null;
  v_draw boolean := false;
  v_status text := 'pending';
  v_answers jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into d from public.hunter_duels where id = p_duel_id for update;
  if not found then
    raise exception 'duel_not_found';
  end if;
  if d.status <> 'pending' then
    raise exception 'duel_closed';
  end if;
  if d.challenger_id <> uid and d.opponent_id <> uid then
    raise exception 'not_participant';
  end if;
  if (d.challenger_id = uid and d.challenger_done) or (d.opponent_id = uid and d.opponent_done) then
    raise exception 'already_submitted';
  end if;

  v_n := jsonb_array_length(d.questions);

  -- O placar é recalculado aqui a partir das respostas escolhidas.
  -- p_score e p_time_s enviados pelo navegador são ignorados (não são confiáveis).
  with ans as (
    select distinct on (raw.idx) raw.idx, raw.chosen, raw.tm
      from (
        select public.safe_int(a->>'index', -1, 1000) as idx,
               public.safe_int(a->>'chosen', -1, 9) as chosen,
               public.safe_int(a->>'time_s', 1, 25) as tm
          from jsonb_array_elements(
                 case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end
               ) a
      ) raw
     where raw.idx >= 0 and raw.idx < v_n
     order by raw.idx
  )
  select coalesce(sum(case when ans.chosen = public.safe_int(d.questions->(ans.idx)->>'correct_index', 0, 9) then 1 else 0 end), 0)::int,
         coalesce(sum(ans.tm), 0)::int,
         count(*)::int
    into v_score, v_time, v_answered
    from ans;

  v_time := greatest(1, v_time + 25 * (v_n - v_answered));
  v_answers := case when jsonb_typeof(p_answers) = 'array' and jsonb_array_length(p_answers) <= 50 then p_answers else '[]'::jsonb end;

  if d.challenger_id = uid then
    d.challenger_score := v_score;
    d.challenger_time_s := v_time;
    d.challenger_answers := v_answers;
    d.challenger_done := true;
  else
    d.opponent_score := v_score;
    d.opponent_time_s := v_time;
    d.opponent_answers := v_answers;
    d.opponent_done := true;
  end if;

  if d.challenger_done and d.opponent_done then
    v_status := 'completed';
    if d.challenger_score > d.opponent_score then
      v_winner := d.challenger_id;
    elsif d.opponent_score > d.challenger_score then
      v_winner := d.opponent_id;
    elsif d.challenger_time_s < d.opponent_time_s then
      v_winner := d.challenger_id;
    elsif d.opponent_time_s < d.challenger_time_s then
      v_winner := d.opponent_id;
    else
      v_draw := true;
    end if;
  end if;

  update public.hunter_duels
     set challenger_score = d.challenger_score,
         challenger_time_s = d.challenger_time_s,
         challenger_answers = d.challenger_answers,
         challenger_done = d.challenger_done,
         opponent_score = d.opponent_score,
         opponent_time_s = d.opponent_time_s,
         opponent_answers = d.opponent_answers,
         opponent_done = d.opponent_done,
         winner_id = v_winner,
         is_draw = v_draw,
         status = v_status,
         completed_at = case when v_status = 'completed' then now() else completed_at end
   where id = p_duel_id
   returning * into d;

  return to_jsonb(d);
end;
$$;

revoke all on function public.submit_hunter_duel_round(uuid, integer, integer, jsonb) from public, anon;
grant execute on function public.submit_hunter_duel_round(uuid, integer, integer, jsonb) to authenticated, service_role;
