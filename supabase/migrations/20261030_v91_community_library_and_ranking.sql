-- Migração v91:
-- 1) Ranking Geral de Caçadores com Perfil Primário e Secundário (ex.: PMPE e PPPE), sem exibir TAF no Ranking.
-- 2) Biblioteca Compartilhada da Comunidade por Concurso/Portal (ex.: PMPE, PPPE, PCPE, PRF)
--    com proteção total de privacidade: NUNCA expõe storage_path/PDF original para download por terceiros
--    e higieniza automaticamente CPFs, e-mails e marcas d'água pessoais no conteúdo compartilhado.

create or replace function public.normalize_exam_slug(p_name text, p_org text default '')
returns text
language plpgsql
immutable
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
  if raw ~ '(^|[^a-z])(pmpe|policia militar de pernambuco|soldado pmpe|oficial pmpe)([^a-z]|$)' then
    return 'pmpe';
  elsif raw ~ '(^|[^a-z])(pppe|policia penal de pernambuco|policial penal pe|agente penitenciario pe)([^a-z]|$)' then
    return 'pppe';
  elsif raw ~ '(^|[^a-z])(pcpe|policia civil de pernambuco)([^a-z]|$)' then
    return 'pcpe';
  elsif raw ~ '(^|[^a-z])(cbmpe|bombeiro militar de pernambuco|bombeiros pe)([^a-z]|$)' then
    return 'cbmpe';
  elsif raw ~ '(^|[^a-z])(prf|policia rodoviaria federal)([^a-z]|$)' then
    return 'prf';
  elsif raw ~ '(^|[^a-z])(pf|policia federal)([^a-z]|$)' then
    return 'pf';
  elsif raw ~ '(^|[^a-z])(pmba|policia militar da bahia)([^a-z]|$)' then
    return 'pmba';
  elsif raw ~ '(^|[^a-z])(pmce|policia militar do ceara)([^a-z]|$)' then
    return 'pmce';
  elsif raw ~ '(^|[^a-z])(pmpb|policia militar da paraiba)([^a-z]|$)' then
    return 'pmpb';
  elsif raw ~ '(^|[^a-z])(pmal|policia militar de alagoas)([^a-z]|$)' then
    return 'pmal';
  end if;

  raw := regexp_replace(
    lower(
      translate(
        coalesce(p_name, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
      )
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  raw := regexp_replace(raw, '(^-+|-+$)', '', 'g');
  return coalesce(nullif(left(raw, 40), ''), 'geral');
end;
$$;

create or replace function public.sanitize_personal_watermarks(p_text text)
returns text
language sql
immutable
as $$
  select
    regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(p_text, ''),
          '\m\d{3}\.?\d{3}\.?\d{3}\s*[-/]\s*\d{2}\M',
          '[CPF PROTEGIDO]',
          'g'
        ),
        '(?i)(cpf|inscrito|licenciado para|aluno\(a\)|comprador)\s*[:\-]?\s*[0-9.\-]{8,18}',
        ': [DADO PROTEGIDO]',
        'g'
      ),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
      '[EMAIL PROTEGIDO]',
      'g'
    );
$$;

create or replace function public.sanitize_generated_jsonb(p_content jsonb)
returns jsonb
language sql
immutable
as $$
  select
    case
      when p_content is null then '{}'::jsonb
      else (public.sanitize_personal_watermarks(p_content::text))::jsonb
    end;
$$;

-- 1) Ranking Geral de Caçadores (Sem TAF e com Perfil Primário + Secundário quando houver 2 concursos)
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
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', c.user_id,
        'is_me', (c.user_id = uid),
        'name', c.name,
        'role', c.role,
        'secondary_role', c.secondary_role,
        'streak', c.streak,
        'best_streak', c.best_streak,
        'last_study', c.last_study,
        'missions_done', c.missions_done,
        'questions_total', c.questions_total,
        'questions_correct', c.questions_correct,
        'accuracy', c.accuracy,
        'xp', c.xp,
        'updated_at', c.updated_at
      )
      order by c.streak desc, c.xp desc, c.accuracy desc, c.missions_done desc, c.name asc
    ),
    '[]'::jsonb
  )
  into result
  from computed c;

  return result;
end;
$$;

revoke all on function public.get_hunters_leaderboard() from public;
grant execute on function public.get_hunters_leaderboard() to authenticated, service_role;

-- 2) Biblioteca Compartilhada da Comunidade por Concurso/Portal (Sem expor PDF original nem CPF)
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
  v_topics jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Documentos prontos de outros usuários do mesmo concurso (SEM storage_path e SEM source_url para impedir download do PDF bruto)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'campaign_id', d.campaign_id,
        'title', public.sanitize_personal_watermarks(d.title),
        'document_type', case when d.document_type = 'edital_concurso' then 'edital' else d.document_type end,
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
    where g.user_id <> uid
      and g.content_type = 'summary'
      and public.normalize_exam_slug(sc.name, coalesce(sc.organization, '')) = v_slug
    order by g.created_at desc
    limit 250
  ) g;

  -- Tópicos do edital já verticalizados por colegas do mesmo concurso (caso o aluno queira aproveitar o edital pronto)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'subject', t.subject,
        'unit_name', t.unit_name,
        'topic', t.topic,
        'edital_order', t.edital_order,
        'subject_order', t.subject_order,
        'learning_order', t.learning_order,
        'difficulty', t.difficulty,
        'prerequisite_topic', t.prerequisite_topic,
        'pedagogical_reason', t.pedagogical_reason
      )
      order by t.subject_order asc nulls last, t.learning_order asc nulls last, t.edital_order asc nulls last
    ),
    '[]'::jsonb
  )
  into v_topics
  from public.campaign_topics t
  where t.campaign_id = (
    select sc.id
    from public.study_campaigns sc
    where sc.user_id <> uid
      and public.normalize_exam_slug(sc.name, coalesce(sc.organization, '')) = v_slug
      and exists (select 1 from public.campaign_topics ct where ct.campaign_id = sc.id)
    order by (select count(*) from public.campaign_topics ct where ct.campaign_id = sc.id) desc, sc.created_at desc
    limit 1
  );

  return jsonb_build_object(
    'exam_slug', v_slug,
    'documents', v_docs,
    'summaries', v_summaries,
    'edital_topics', v_topics
  );
end;
$$;

revoke all on function public.get_community_exam_library(text, text) from public;
grant execute on function public.get_community_exam_library(text, text) to authenticated, service_role;
