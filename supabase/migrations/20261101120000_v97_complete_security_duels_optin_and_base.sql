-- v97 CONSOLIDADA (INCLUI v96_a + v96_b + v97):
-- Basta colar este arquivo no SQL Editor do Supabase e clicar em Run.
-- Totalmente idempotente ("create or replace" / "if not exists" / "drop function if exists").

-- 0) Remoção segura da função legada que apagava perfis e criação do relatório somente-leitura (v96_a)
-- v96_a: CORREÇÃO CRÍTICA DE SEGURANÇA — execute primeiro e sozinha.
-- Problema: public.cleanup_duplicate_hunter_profiles() é SECURITY DEFINER, apaga linhas de auth.users
-- e estava liberada para QUALQUER usuário logado (rpc pelo navegador). Como o nome exibido é editável pelo
-- próprio usuário, era possível provocar a exclusão da conta de outra pessoa. Ela também rodava sozinha
-- (select ...) a cada execução das migrações v92/v93/v95.
-- Correção: remove a função de exclusão e cria um RELATÓRIO somente leitura, só para o service_role.

drop function if exists public.cleanup_duplicate_hunter_profiles();

create or replace function public.report_duplicate_hunter_profiles()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome_normalizado', t.norm, 'contas', t.contas)), '[]'::jsonb)
  from (
    select b.norm,
           jsonb_agg(jsonb_build_object(
             'user_id', b.id, 'email', b.email, 'criado_em', b.created_at, 'ultimo_login', b.last_sign_in_at
           ) order by b.created_at) as contas
    from (
      select u.id, u.email, u.created_at, u.last_sign_in_at,
             public.normalize_hunter_name(coalesce(
               nullif(trim(us.state->'publicProfile'->>'name'), ''),
               nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
               nullif(trim(u.raw_user_meta_data->>'name'), ''),
               ''
             )) as norm
      from auth.users u
      left join public.user_state us on us.user_id = u.id
    ) b
    where b.norm <> ''
    group by b.norm
    having count(*) > 1
  ) t;
$$;

revoke all on function public.report_duplicate_hunter_profiles() from public, anon, authenticated;
grant execute on function public.report_duplicate_hunter_profiles() to service_role;

-- Conferência (deve retornar 0 linhas):
-- select grantee, privilege_type from information_schema.routine_privileges
--  where routine_name = 'cleanup_duplicate_hunter_profiles';


-- 0.1) Conversão inteira segura (v96_b)
create or replace function public.safe_int(p_text text, p_min int default 0, p_max int default 1000000)
returns int
language sql
immutable
set search_path = public
as $$
  select case when p_text ~ '^-?[0-9]{1,9}$' then greatest(p_min, least(p_max, p_text::int)) else p_min end
$$;


-- v97: FECHAMENTO COMPLETO DOS 10 PONTOS DE AUDITORIA (DUELO ANTI-TRAPAÇA, RANKING VERIFICADO, OPT-IN COMUNIDADE E BASE).
-- Totalmente idempotente ("create or replace" / "if not exists").

-- 1) Garantir tabela base user_state para reconstrução limpa do banco
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_revision bigint not null default 0,
  reset_epoch bigint not null default 0,
  updated_by_device text,
  server_updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- 2) Biblioteca Comunitária ativa por padrão para todos os materiais (exceto editais, que são individuais)
alter table if exists public.study_documents
  add column if not exists share_with_community boolean not null default true;

alter table if exists public.study_documents
  alter column share_with_community set default true;

-- Restaura visibilidade imediata na comunidade para todos os materiais já enviados pelos usuários
update public.study_documents
   set share_with_community = true
 where document_type not in ('edital', 'edital_concurso')
   and coalesce(metadata->>'private_only', 'false') <> 'true';

-- Remove eventuais tópicos de edital que eram apenas rótulos de incidência ("ALTA", "MÉDIA", "BAIXA")
delete from public.campaign_topics
 where regexp_replace(
         lower(
           translate(
             regexp_replace(trim(coalesce(topic, '')), '^\d+\.\s*', ''),
             'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
             'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'
           )
         ),
         '\s+',
         ' ',
         'g'
       ) in ('alta', 'media', 'baixa', 'alta media', 'media alta', 'incidencia alta', 'incidencia media', 'incidencia baixa', 'cai muito', 'cai com frequencia', 'dificilmente cai');

create or replace function public.normalize_exam_slug(p_name text, p_org text default '')
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  raw text := lower(
    translate(
      coalesce(p_name, '') || ' ' || coalesce(p_org, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
    )
  );
begin
  if raw ~ '(^|[^a-z])(pm\s*-?\s*pe|policia militar.*pe|policia militar.*pernambuco|soldado pmpe|oficial pmpe)([^a-z]|$)' then
    return 'pmpe';
  elsif raw ~ '(^|[^a-z])(pp\s*-?\s*pe|policia penal|policial penal|agente penitenciario)([^a-z]|$)' then
    return 'pppe';
  elsif raw ~ '(^|[^a-z])(pc\s*-?\s*pe|policia civil.*pe|policia civil.*pernambuco)([^a-z]|$)' then
    return 'pcpe';
  elsif raw ~ '(^|[^a-z])(cbm\s*-?\s*pe|bombeiro.*pe|bombeiro.*pernambuco)([^a-z]|$)' then
    return 'cbmpe';
  elsif raw ~ '(^|[^a-z])(prf|policia rodoviaria federal)([^a-z]|$)' then
    return 'prf';
  elsif raw ~ '(^|[^a-z])(pf|policia federal)([^a-z]|$)' then
    return 'pf';
  end if;

  raw := regexp_replace(raw, '[^a-z0-9]+', '-', 'g');
  raw := regexp_replace(raw, '(^-+|-+$)', '', 'g');
  return coalesce(nullif(left(raw, 40), ''), 'geral');
end;
$$;

create or replace function public.set_document_community_sharing(
  p_document_id uuid,
  p_shared boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_doc public.study_documents%rowtype;
  v_next boolean := coalesce(p_shared, true);
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_doc
    from public.study_documents
   where id = p_document_id and user_id = uid
   for update;

  if not found then
    raise exception 'document_not_found';
  end if;

  if v_doc.document_type in ('edital', 'edital_concurso') then
    raise exception 'edital_cannot_be_shared';
  end if;

  update public.study_documents
     set share_with_community = v_next,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('share_with_community', v_next, 'private_only', (not v_next))
   where id = p_document_id and user_id = uid
   returning * into v_doc;

  return jsonb_build_object(
    'id', v_doc.id,
    'share_with_community', v_doc.share_with_community
  );
end;
$$;

revoke all on function public.set_document_community_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_document_community_sharing(uuid, boolean) to authenticated, service_role;

-- Atualizar get_community_exam_library para exibir todos os materiais prontos da comunidade (exceto editais)
create or replace function public.get_community_exam_library(
  p_exam_name text default '',
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

  -- Acervo universal: qualquer usuário autenticado acessa todos os documentos prontos
  -- compartilhados no banco, independentemente do perfil/concurso (PMPE, CBMPE, PPPE, etc.).
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
        'exam_slug', coalesce(public.normalize_exam_slug(sc.name, coalesce(sc.organization, '')), 'universal'),
        'portal_name', coalesce(sc.name, 'Acervo Universal'),
        'author_name', coalesce(
          nullif(trim(us.state->'publicProfile'->>'name'), ''),
          nullif(trim(us.state->'hunterStats'->>'name'), ''),
          nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          'Colega da Comunidade'
        )
      )
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  into v_docs
  from public.study_documents d
  left join public.study_campaigns sc on sc.id = d.campaign_id
  left join auth.users u on u.id = d.user_id
  left join public.user_state us on us.user_id = d.user_id
  where d.processing_status = 'ready'
    and d.document_type not in ('edital', 'edital_concurso')
    and coalesce(d.share_with_community, true) = true
    and coalesce(d.metadata->>'private_only', 'false') <> 'true';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'source_document_id', g.source_document_id,
        'content_type', g.content_type,
        'title', public.sanitize_personal_watermarks(g.title),
        'content', public.sanitize_generated_jsonb(g.content),
        'source_refs', g.source_refs,
        'created_at', g.created_at,
        'is_community', true,
        'exam_slug', 'universal',
        'document_type', coalesce(g.doc_type, 'material')
      )
      order by g.created_at asc
    ),
    '[]'::jsonb
  )
  into v_summaries
  from (
    select g.*, sd.document_type as doc_type
    from public.generated_study_content g
    left join public.study_campaigns sc on sc.id = g.campaign_id
    left join public.study_documents sd on sd.id = g.source_document_id
    where g.content_type in ('summary', 'question_pack')
      and (sd.id is null or (
        sd.document_type not in ('edital', 'edital_concurso')
        and coalesce(sd.share_with_community, true) = true
        and coalesce(sd.metadata->>'private_only', 'false') <> 'true'
      ))
    order by g.created_at desc
    limit 1000
  ) g;

  return jsonb_build_object(
    'exam_slug', 'universal',
    'documents', v_docs,
    'summaries', v_summaries,
    'edital_topics', '[]'::jsonb
  );
end;
$$;

revoke all on function public.get_community_exam_library(text, text) from public, anon;
grant execute on function public.get_community_exam_library(text, text) to authenticated, service_role;

-- 3) Duelos sem respostas certas abertas antes da resposta do jogador + correção unitária no servidor
create or replace function public.redact_duel_questions_for_player(
  p_questions jsonb,
  p_hide_answers boolean
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when p_questions is null or jsonb_typeof(p_questions) <> 'array' then '[]'::jsonb
    when not coalesce(p_hide_answers, false) then p_questions
    else coalesce(
      (
        select jsonb_agg(
          (q - 'correct_index' - 'explanation') || jsonb_build_object('correct_index', null, 'explanation', '')
        )
        from jsonb_array_elements(p_questions) q
      ),
      '[]'::jsonb
    )
  end
$$;

create or replace function public.grade_hunter_duel_question(
  p_duel_id uuid,
  p_question_index integer,
  p_chosen integer
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
  v_q jsonb;
  v_correct int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into d from public.hunter_duels where id = p_duel_id;
  if not found then
    raise exception 'duel_not_found';
  end if;
  if d.challenger_id <> uid and d.opponent_id <> uid then
    raise exception 'not_participant';
  end if;

  v_n := jsonb_array_length(coalesce(d.questions, '[]'::jsonb));
  if p_question_index is null or p_question_index < 0 or p_question_index >= v_n then
    raise exception 'invalid_question_index';
  end if;

  v_q := d.questions->p_question_index;
  v_correct := public.safe_int(v_q->>'correct_index', 0, 9);

  return jsonb_build_object(
    'index', p_question_index,
    'chosen', p_chosen,
    'correct', (p_chosen = v_correct),
    'correct_index', v_correct,
    'explanation', coalesce(v_q->>'explanation', '')
  );
end;
$$;

revoke all on function public.grade_hunter_duel_question(uuid, integer, integer) from public, anon;
grant execute on function public.grade_hunter_duel_question(uuid, integer, integer) to authenticated, service_role;

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

  -- Oculta correct_index e explanation enquanto o jogador atual ainda não concluiu sua rodada!
  select coalesce(
    jsonb_agg(
      (to_jsonb(d) - 'questions') || jsonb_build_object(
        'questions',
        public.redact_duel_questions_for_player(
          d.questions,
          d.status = 'pending' and (
            (d.challenger_id = uid and not coalesce(d.challenger_done, false)) or
            (d.opponent_id = uid and not coalesce(d.opponent_done, false))
          )
        )
      )
      order by d.created_at desc
    ),
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

revoke all on function public.get_duel_arena_hub() from public, anon;
grant execute on function public.get_duel_arena_hub() to authenticated, service_role;

-- 4) Ranking com teto de XP verificado pelo histórico real (impede inflar XP manualmente no navegador)
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
      coalesce(public.safe_int(us.state->'learning'->>'xp', 0, 30000), 0) as learning_xp,
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
      least(ru.streak, greatest(1, coalesce(activity_stats.days_count, 0) + 2)) as streak,
      least(ru.best_streak, greatest(1, coalesce(activity_stats.days_count, 0) + 5)) as best_streak,
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
      least(
        coalesce(done_stats.done_count, 0) * 100
        + coalesce(boss_stats.boss_count, 0) * 300
        + coalesce(score_stats.score_xp, 0)
        + ru.learning_xp
        + 1500,
        greatest(
          coalesce(public.safe_int(ru.st->'hunterStats'->>'xp', 0, 1000000), 0),
          coalesce(done_stats.done_count, 0) * 100
          + coalesce(boss_stats.boss_count, 0) * 300
          + coalesce(score_stats.score_xp, 0)
          + ru.learning_xp
        )
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
      select count(*)::int as days_count
      from jsonb_each(
        case when jsonb_typeof(ru.st->'studyByDay') = 'object' then ru.st->'studyByDay' else '{}'::jsonb end
      ) sd
    ) activity_stats on true
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

revoke all on function public.get_hunters_leaderboard() from public, anon;
grant execute on function public.get_hunters_leaderboard() to authenticated, service_role;

-- 5) Endurecimento de check_email_registered contra enumeração em massa (mantendo retorno jsonb {"registered": boolean})
drop function if exists public.check_email_registered(text);

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
  if length(v_clean) < 6 or length(v_clean) > 180 or v_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('registered', false);
  end if;

  select exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = v_clean
  ) into v_exists;

  return jsonb_build_object('registered', v_exists);
end;
$$;

revoke all on function public.check_email_registered(text) from public;
grant execute on function public.check_email_registered(text) to anon, authenticated, service_role;

-- 6) Políticas e RPCs de criação/envio de Duelo X1 (v96_b)
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
           'topic', public.normalize_legal_orthography(left(coalesce(q->>'topic', ''), 200)),
           'statement', public.normalize_legal_orthography(left(coalesce(q->>'statement', ''), 1500)),
           'options', (
             select coalesce(jsonb_agg(public.normalize_legal_orthography(left(o #>> '{}', 500))), '[]'::jsonb)
               from jsonb_array_elements(q->'options') o
           ),
           'correct_index', public.safe_int(q->>'correct_index', 0, 9),
           'explanation', public.normalize_legal_orthography(left(coalesce(q->>'explanation', ''), 1500)),
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


-- ============================================================================
-- 7) NORMALIZAÇÃO ORTOGRÁFICA JURÍDICA (art. 5º, § 1º, 1ª, 5ª, Lei nº)
--    Corrige automaticamente "art. 5o", "5a", "§ 1o" em todo o banco e em novos duelos/conteúdos
-- ============================================================================

create or replace function public.normalize_legal_orthography(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  s text := coalesce(p_text, '');
begin
  if s = '' then
    return s;
  end if;
  -- 1. Artigos 1º a 9º (ex.: "art. 5o", "art. 5a", "Art. 5°", "artigo 1o" -> "art. 5º" / "Art. 5º")
  s := regexp_replace(s, '\m([Aa]rt(?:igos?)?\.?\s*)([1-9])\s*(?:[oOaA]|º|°|ª)\M', '\1\2º', 'g');
  s := regexp_replace(s, '\m([Aa]rt(?:igos?)?\.?\s*)([1-9])(?=\s+(?:da|do|dos|das|de|e|ou|a|ao|c/c|caput|par[aá]grafo|inciso)|[,.;:()\-–—]|$)', '\1\2º', 'g');
  -- Artigos >= 10 sem sufixo "o/a" indevido (ex.: "art. 10o", "art. 144o" -> "art. 10", "art. 144")
  s := regexp_replace(s, '\m([Aa]rt(?:igos?)?\.?\s*)(\d{2,3})\s*(?:[oOaA]|º|°|ª)\M', '\1\2', 'g');
  -- 2. Parágrafos 1º a 9º (ex.: "§ 1o", "§ 2a", "§ 1°", "parágrafo 1o" -> "§ 1º")
  s := regexp_replace(s, '(§+\s*)([1-9])\s*(?:[oOaA]|º|°|ª)?(?=\M|\s|[,.;:()\-–—]|$)', '\1\2º', 'g');
  s := regexp_replace(s, '\m([Pp]ar[aá]grafos?\s+)([1-9])\s*(?:[oOaA]|º|°|ª)\M', '\1\2º', 'g');
  -- 3. Ordinais femininos e masculinos corrompidos (ex.: "1a", "2a", "5a" -> "1ª", "2ª", "5ª" e "1o", "5o" -> "1º", "5º")
  s := regexp_replace(s, '\m([1-9]\d?)[aA]\M(?!\s*\))', '\1ª', 'g');
  s := regexp_replace(s, '\m([1-9]\d?)[oO]\M', '\1º', 'g');
  s := regexp_replace(s, '\m([1-9])\s*°(?!\s*[CFK]\M)', '\1º', 'g');
  -- 4. Abreviatura de número de lei/decreto (ex.: "Lei no 8.112", "Lei n° 8.112" -> "Lei nº 8.112")
  s := regexp_replace(s, '\m([Ll]ei|[Dd]ecreto|[Pp]ortaria|[Rr]esolu[cç][aã]o|[Ee]menda|[Ss][uú]mula)\s+n\.?\s*(?:[oO]|°)(?=\s*\d)', '\1 nº', 'g');
  return s;
end;
$$;

-- Atualiza os conteúdos, questões, duelos e tópicos já existentes no banco para corrigir "art. 5o" / "5a" -> "art. 5º" / "5ª"
update public.generated_study_content
   set title = public.normalize_legal_orthography(title),
       content = (public.normalize_legal_orthography(content::text))::jsonb
 where content is not null
   and (content::text ~ '\m([Aa]rt\.?\s*\d+\s*[oOaA°]|[1-9][oOaA])\M' or title ~ '\m([Aa]rt\.?\s*\d+\s*[oOaA°]|[1-9][oOaA])\M');

update public.hunter_duels
   set questions = (public.normalize_legal_orthography(questions::text))::jsonb
 where questions is not null
   and questions::text ~ '\m([Aa]rt\.?\s*\d+\s*[oOaA°]|[1-9][oOaA])\M';

update public.campaign_topics
   set topic = public.normalize_legal_orthography(topic),
       unit_name = public.normalize_legal_orthography(coalesce(unit_name, ''))
 where topic ~ '\m([Aa]rt\.?\s*\d+\s*[oOaA°]|[1-9][oOaA])\M';

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'shared_question_bank') then
    execute $q$
      update public.shared_question_bank
         set statement = public.normalize_legal_orthography(statement),
             options = (public.normalize_legal_orthography(options::text))::jsonb,
             explanation = public.normalize_legal_orthography(coalesce(explanation, '')),
             topic = public.normalize_legal_orthography(coalesce(topic, ''))
       where statement ~ '\m([Aa]rt\.?\s*\d+\s*[oOaA°]|[1-9][oOaA])\M'
          or options::text ~ '\m([Aa]rt\.?\s*\d+\s*[oOaA°]|[1-9][oOaA])\M'
    $q$;
  end if;
end;
$$;


-- ============================================================================
-- 8) RECUSAR / CANCELAR CONVITE DE DUELO X1 (decline_hunter_duel)
-- ============================================================================

create or replace function public.decline_hunter_duel(
  p_duel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d public.hunter_duels%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into d
    from public.hunter_duels
   where id = p_duel_id
   for update;

  if not found then
    raise exception 'duel_not_found';
  end if;

  if d.challenger_id <> uid and d.opponent_id <> uid then
    raise exception 'not_participant';
  end if;

  if d.status <> 'pending' then
    raise exception 'duel_closed';
  end if;

  update public.hunter_duels
     set status = 'declined',
         completed_at = now()
   where id = p_duel_id
   returning * into d;

  return jsonb_build_object(
    'id', d.id,
    'status', d.status,
    'declined_by', uid
  );
end;
$$;

revoke all on function public.decline_hunter_duel(uuid) from public, anon;
grant execute on function public.decline_hunter_duel(uuid) to authenticated, service_role;


-- ============================================================================
-- 9) CHAT INTERNO DA GUILDA DE CAÇADORES & LOBBY INTERATIVO (hunter_guild_messages)
-- ============================================================================

create table if not exists public.hunter_guild_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Caçador',
  author_role text not null default 'PMPE — Soldado',
  author_xp integer not null default 0,
  channel text not null default 'geral' check (channel in ('geral', 'duelos', 'duvidas')),
  message text not null check (char_length(trim(message)) between 1 and 800),
  reply_to_id uuid references public.hunter_guild_messages(id) on delete set null,
  reply_author text,
  reply_excerpt text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hunter_guild_messages_channel_created
  on public.hunter_guild_messages(channel, created_at desc);

create index if not exists idx_hunter_guild_messages_created
  on public.hunter_guild_messages(created_at desc);

alter table public.hunter_guild_messages enable row level security;

drop policy if exists "Autenticados leem chat da guilda" on public.hunter_guild_messages;
create policy "Autenticados leem chat da guilda"
  on public.hunter_guild_messages
  for select
  to authenticated
  using (true);

drop policy if exists "Autenticados enviam mensagem propria na guilda" on public.hunter_guild_messages;
create policy "Autenticados enviam mensagem propria na guilda"
  on public.hunter_guild_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Autenticados apagam propria mensagem na guilda" on public.hunter_guild_messages;
create policy "Autenticados apagam propria mensagem na guilda"
  on public.hunter_guild_messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.send_guild_chat_message(
  p_message text,
  p_channel text default 'geral',
  p_reply_to_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_clean_msg text;
  v_channel text := lower(trim(coalesce(p_channel, 'geral')));
  v_author_name text := 'Caçador';
  v_author_role text := 'PMPE — Soldado';
  v_author_xp int := 0;
  v_reply_author text := null;
  v_reply_excerpt text := null;
  v_row public.hunter_guild_messages%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_channel not in ('geral', 'duelos', 'duvidas') then
    v_channel := 'geral';
  end if;

  v_clean_msg := public.normalize_legal_orthography(
    public.sanitize_personal_watermarks(left(trim(coalesce(p_message, '')), 800))
  );

  if length(v_clean_msg) < 1 then
    raise exception 'empty_message';
  end if;

  select
    left(coalesce(
      nullif(trim(us.state->'publicProfile'->>'name'), ''),
      nullif(trim(us.state->'hunterStats'->>'name'), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      'Caçador'
    ), 60),
    left(coalesce(
      nullif(trim(us.state->'publicProfile'->>'role'), ''),
      nullif(trim(us.state->'hunterStats'->>'role'), ''),
      'PMPE — Soldado'
    ), 80),
    greatest(0, coalesce(public.safe_int(us.state->'hunterStats'->>'xp', 0, 1000000), 0))
  into v_author_name, v_author_role, v_author_xp
  from auth.users u
  left join public.user_state us on us.user_id = u.id
  where u.id = uid;

  if p_reply_to_id is not null then
    select author_name, left(message, 120)
      into v_reply_author, v_reply_excerpt
      from public.hunter_guild_messages
     where id = p_reply_to_id;
  end if;

  insert into public.hunter_guild_messages (
    user_id, author_name, author_role, author_xp,
    channel, message, reply_to_id, reply_author, reply_excerpt
  )
  values (
    uid, coalesce(v_author_name, 'Caçador'), coalesce(v_author_role, 'PMPE — Soldado'), coalesce(v_author_xp, 0),
    v_channel, v_clean_msg, p_reply_to_id, v_reply_author, v_reply_excerpt
  )
  returning * into v_row;

  update public.user_state
     set server_updated_at = now()
   where user_id = uid;

  return to_jsonb(v_row) || jsonb_build_object('is_me', true);
end;
$$;

revoke all on function public.send_guild_chat_message(text, text, uuid) from public, anon;
grant execute on function public.send_guild_chat_message(text, text, uuid) to authenticated, service_role;

create or replace function public.get_guild_chat_messages(
  p_channel text default 'all',
  p_limit integer default 80
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_chan text := lower(trim(coalesce(p_channel, 'all')));
  v_lim int := greatest(10, least(150, coalesce(p_limit, 80)));
  v_messages jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.user_state
     set server_updated_at = now()
   where user_id = uid;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'user_id', m.user_id,
        'is_me', (m.user_id = uid),
        'author_name', m.author_name,
        'author_role', m.author_role,
        'author_xp', m.author_xp,
        'channel', m.channel,
        'message', m.message,
        'reply_to_id', m.reply_to_id,
        'reply_author', m.reply_author,
        'reply_excerpt', m.reply_excerpt,
        'created_at', m.created_at
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
  into v_messages
  from (
    select *
      from public.hunter_guild_messages gm
     where (v_chan = 'all' or gm.channel = v_chan)
     order by gm.created_at desc
     limit v_lim
  ) m;

  return jsonb_build_object(
    'messages', v_messages
  );
end;
$$;

revoke all on function public.get_guild_chat_messages(text, integer) from public, anon;
grant execute on function public.get_guild_chat_messages(text, integer) to authenticated, service_role;

create or replace function public.delete_guild_chat_message(
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.hunter_guild_messages
   where id = p_message_id and user_id = uid;

  return jsonb_build_object('deleted', true, 'id', p_message_id);
end;
$$;

revoke all on function public.delete_guild_chat_message(uuid) from public, anon;
grant execute on function public.delete_guild_chat_message(uuid) to authenticated, service_role;
