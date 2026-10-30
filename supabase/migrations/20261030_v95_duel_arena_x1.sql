-- Migração v92:
-- 1) Verifica e exclui perfis duplicados em auth.users (mantendo apenas a conta principal/com mais progresso de cada aluno, como os 4 participantes reais).
-- 2) Impede duplicidade visual no Ranking Geral (get_hunters_leaderboard usa DISTINCT ON por nome normalizado).
-- 3) Cria RPC pública check_email_exists_for_signup para avisar imediatamente quando o usuário tenta criar conta com e-mail já cadastrado.
-- 4) Mantém a Biblioteca Compartilhada da Comunidade por Concurso (get_community_exam_library) com proteção de CPF e bloqueio de download do PDF bruto.

create or replace function public.normalize_hunter_name(p_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(
      translate(
        trim(coalesce(p_name, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
      )
    ),
    '\s+',
    ' ',
    'g'
  );
$$;

-- Função para verificar se o e-mail já está cadastrado antes/durante o cadastro (evita falso "Conta criada" do Supabase)
create or replace function public.check_email_registered(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := lower(trim(coalesce(p_email, '')));
  v_exists boolean := false;
begin
  if v_clean = '' then
    return jsonb_build_object('registered', false);
  end if;

  select exists(
    select 1
    from auth.users u
    where lower(trim(u.email)) = v_clean
  ) into v_exists;

  return jsonb_build_object('registered', v_exists);
end;
$$;

revoke all on function public.check_email_registered(text) from public;
grant execute on function public.check_email_registered(text) to anon, authenticated, service_role;

-- Função que identifica e exclui contas duplicadas (mesmo nome normalizado) que estão vazias/sem progresso,
-- preservando sempre a conta principal (com maior XP, missões, documentos ou login mais recente).
create or replace function public.cleanup_duplicate_hunter_profiles()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer := 0;
  v_deleted_names text[] := array[]::text[];
  rec record;
begin
  for rec in (
    with user_metrics as (
      select
        u.id as user_id,
        u.email,
        coalesce(
          nullif(trim(us.state->'publicProfile'->>'name'), ''),
          nullif(trim(us.state->'hunterStats'->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
          'Caçador'
        ) as display_name,
        coalesce((us.state->'hunterStats'->>'xp')::int, 0) as xp,
        greatest(0, coalesce((us.state->>'streak')::int, 0)) as streak,
        (select count(*)::int from public.study_documents sd where sd.user_id = u.id) as docs_count,
        (select count(*)::int from public.essay_submissions es where es.user_id = u.id) as essays_count,
        (u.email_confirmed_at is not null) as confirmed,
        coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at) as last_active
      from auth.users u
      left join public.user_state us on us.user_id = u.id
    ),
    ranked as (
      select
        um.*,
        public.normalize_hunter_name(um.display_name) as norm_name,
        row_number() over (
          partition by public.normalize_hunter_name(um.display_name)
          order by
            um.xp desc,
            um.streak desc,
            um.docs_count desc,
            um.essays_count desc,
            um.confirmed desc,
            um.last_active desc nulls last
        ) as rn
      from user_metrics um
      where public.normalize_hunter_name(um.display_name) <> ''
    )
    select user_id, display_name, email
    from ranked
    where rn > 1
      and docs_count = 0
      and essays_count = 0
  ) loop
    delete from auth.users where id = rec.user_id;
    v_deleted_count := v_deleted_count + 1;
    v_deleted_names := array_append(v_deleted_names, rec.display_name || ' (' || coalesce(rec.email, 'sem email') || ')');
  end loop;

  return jsonb_build_object(
    'removed_count', v_deleted_count,
    'removed_profiles', to_jsonb(v_deleted_names)
  );
end;
$$;

revoke all on function public.cleanup_duplicate_hunter_profiles() from public;
grant execute on function public.cleanup_duplicate_hunter_profiles() to authenticated, service_role;

-- Executa a limpeza imediatamente ao rodar esta migração no SQL Editor!
select public.cleanup_duplicate_hunter_profiles();

-- Atualiza get_hunters_leaderboard() com deduplicação automática por nome normalizado (DISTINCT ON)
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
        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
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
      greatest(0, coalesce((us.state->>'streak')::int, 0)) as streak,
      greatest(
        0,
        coalesce((us.state->>'bestStreak')::int, 0),
        coalesce((us.state->>'streak')::int, 0)
      ) as best_streak,
      coalesce(us.state->>'lastStudy', '') as last_study,
      coalesce((us.state->'learning'->>'xp')::int, 0) as learning_xp,
      coalesce((us.state->'publicProfile'->>'hidden')::boolean, false) as is_hidden,
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
      order by coalesce((c_item->>'priority')::int, 2) asc
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
          then round((score_stats.q_correct::numeric / score_stats.q_total::numeric) * 100)::int
        else 0
      end as accuracy,
      greatest(
        coalesce((ru.st->'hunterStats'->>'xp')::int, 0),
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
      where d.value = 'true'::jsonb
    ) done_stats on true
    left join lateral (
      select count(*)::int as boss_count
      from jsonb_each(
        case when jsonb_typeof(ru.st->'bosses') = 'object' then ru.st->'bosses' else '{}'::jsonb end
      ) b
      where b.value = 'true'::jsonb
    ) boss_stats on true
    left join lateral (
      select
        coalesce(sum(greatest(0, coalesce((s.item->>'total')::int, 0))), 0)::int as q_total,
        coalesce(sum(greatest(0, coalesce((s.item->>'correct')::int, 0))), 0)::int as q_correct,
        coalesce(
          sum(
            case
              when coalesce((s.item->>'total')::numeric, 0) > 0
                then least(40, floor((coalesce((s.item->>'correct')::numeric, 0) / (s.item->>'total')::numeric) * 40))::int
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

-- Atualização v93: Não compartilha arquivos do tipo 'edital' na Biblioteca da Comunidade (apenas materiais, leis, provas, simulados e anotações)
-- e padroniza títulos removendo prefixos UUID em caixa alta.

create or replace function public.clean_standard_doc_title(p_title text)
returns text
language sql
immutable
as $$
  select upper(
    trim(
      regexp_replace(
        regexp_replace(
          public.sanitize_personal_watermarks(coalesce(p_title, '')),
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}[-_\s]*',
          '',
          'g'
        ),
        '\.pdf$',
        '',
        'i'
      )
    )
  );
$$;

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
        'author_name', coalesce(
          nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          'Colega de ' || upper(v_slug)
        )
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


-- ============================================================================
-- Migração v95: Arena de Duelos X1 (Estilo Perguntados — Cross-Platform PC/Celular)
-- Não altera o XP de estudo. Registra vitórias, sequência invicta e dominação (freguesia) entre usuários.
-- ============================================================================

create table if not exists public.hunter_duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  challenger_name text not null default 'Caçador',
  opponent_name text not null default 'Oponente',
  exam_slug text not null default 'pmpe',
  subject text not null default 'Misto (Estilo Perguntados)',
  difficulty_mode text not null default 'misto',
  questions jsonb not null default '[]'::jsonb,
  challenger_score integer not null default 0,
  challenger_time_s integer not null default 0,
  challenger_answers jsonb not null default '[]'::jsonb,
  challenger_done boolean not null default false,
  opponent_score integer not null default 0,
  opponent_time_s integer not null default 0,
  opponent_answers jsonb not null default '[]'::jsonb,
  opponent_done boolean not null default false,
  winner_id uuid references auth.users(id) on delete set null,
  is_draw boolean not null default false,
  status text not null default 'pending' check (status in ('pending','completed','declined')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_hunter_duels_challenger on public.hunter_duels(challenger_id, status, created_at desc);
create index if not exists idx_hunter_duels_opponent on public.hunter_duels(opponent_id, status, created_at desc);
create index if not exists idx_hunter_duels_status on public.hunter_duels(status, completed_at desc);

alter table public.hunter_duels enable row level security;

drop policy if exists "Autenticados visualizam duelos da arena" on public.hunter_duels;
create policy "Autenticados visualizam duelos da arena"
  on public.hunter_duels
  for select
  to authenticated
  using (true);

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
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_opponent_id is null or p_opponent_id = uid then
    raise exception 'invalid_opponent';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 then
    raise exception 'invalid_questions';
  end if;

  select coalesce(
    nullif(trim(us.state->'publicProfile'->>'name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'Caçador'
  ) into v_challenger_name
  from auth.users u
  left join public.user_state us on us.user_id = u.id
  where u.id = uid;

  select coalesce(
    nullif(trim(us.state->'publicProfile'->>'name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'Oponente'
  ) into v_opponent_name
  from auth.users u
  left join public.user_state us on us.user_id = u.id
  where u.id = p_opponent_id;

  insert into public.hunter_duels (
    challenger_id,
    opponent_id,
    challenger_name,
    opponent_name,
    subject,
    difficulty_mode,
    questions,
    status
  )
  values (
    uid,
    p_opponent_id,
    coalesce(v_challenger_name, 'Caçador'),
    coalesce(v_opponent_name, 'Oponente'),
    coalesce(nullif(trim(p_subject), ''), 'Roleta Mista'),
    coalesce(nullif(trim(p_mode), ''), 'misto'),
    p_questions,
    'pending'
  )
  returning id into v_duel_id;

  return jsonb_build_object('duel_id', v_duel_id, 'status', 'pending');
end;
$$;

revoke all on function public.create_hunter_duel(uuid, text, text, jsonb) from public;
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
  v_winner uuid := null;
  v_draw boolean := false;
  v_status text := 'pending';
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into d from public.hunter_duels where id = p_duel_id for update;
  if not found then
    raise exception 'duel_not_found';
  end if;

  if d.challenger_id = uid then
    d.challenger_score := greatest(0, coalesce(p_score, 0));
    d.challenger_time_s := greatest(1, coalesce(p_time_s, 1));
    d.challenger_answers := coalesce(p_answers, '[]'::jsonb);
    d.challenger_done := true;
  elsif d.opponent_id = uid then
    d.opponent_score := greatest(0, coalesce(p_score, 0));
    d.opponent_time_s := greatest(1, coalesce(p_time_s, 1));
    d.opponent_answers := coalesce(p_answers, '[]'::jsonb);
    d.opponent_done := true;
  else
    raise exception 'not_participant';
  end if;

  if d.challenger_done and d.opponent_done then
    v_status := 'completed';
    if d.challenger_score > d.opponent_score then
      v_winner := d.challenger_id;
    elsif d.opponent_score > d.challenger_score then
      v_winner := d.opponent_id;
    else
      -- Desempate por menor tempo de resposta (estilo Perguntados)
      if d.challenger_time_s < d.opponent_time_s then
        v_winner := d.challenger_id;
      elsif d.opponent_time_s < d.challenger_time_s then
        v_winner := d.opponent_id;
      else
        v_draw := true;
      end if;
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

revoke all on function public.submit_hunter_duel_round(uuid, integer, integer, jsonb) from public;
grant execute on function public.submit_hunter_duel_round(uuid, integer, integer, jsonb) to authenticated, service_role;

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
        split_part(coalesce(u.email, ''), '@', 1),
        'Caçador'
      )
    ))
      u.id as user_id,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'name'), ''),
        nullif(trim(us.state->'hunterStats'->>'name'), ''),
        nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(u.raw_user_meta_data->>'name'), ''),
        split_part(coalesce(u.email, ''), '@', 1),
        'Caçador'
      ) as name,
      coalesce(
        nullif(trim(us.state->'publicProfile'->>'role'), ''),
        nullif(trim(us.state->'hunterStats'->>'role'), ''),
        'PMPE — Soldado'
      ) as role,
      coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at, now()) as last_seen,
      (coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at, now()) > now() - interval '5 minutes') as is_online
    from auth.users u
    left join public.user_state us on us.user_id = u.id
    where coalesce((us.state->'publicProfile'->>'hidden')::boolean, false) = false or u.id = uid
    order by
      public.normalize_hunter_name(
        coalesce(
          nullif(trim(us.state->'publicProfile'->>'name'), ''),
          nullif(trim(us.state->'hunterStats'->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          split_part(coalesce(u.email, ''), '@', 1),
          'Caçador'
        )
      ),
      (u.id = uid) desc,
      coalesce((us.state->'hunterStats'->>'xp')::int, 0) desc,
      coalesce(us.server_updated_at, u.last_sign_in_at, u.created_at) desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', rh.user_id,
        'is_me', (rh.user_id = uid),
        'name', rh.name,
        'role', rh.role,
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
