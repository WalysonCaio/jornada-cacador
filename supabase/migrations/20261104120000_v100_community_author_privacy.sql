-- v100: PRIVACIDADE DO AUTOR NA BIBLIOTECA COMUNITÁRIA
-- A v99 passou a devolver, como "author_name", o nome real do cadastro (full_name/name em auth.users)
-- de quem enviou o material, para todos os usuários logados e sem que a pessoa tenha escolhido isso.
-- Agora só é exibido o nome PÚBLICO que o próprio usuário definiu no perfil (publicProfile.name), e quem
-- marcou "Ocultar meu perfil" aparece como "Colega da Comunidade". Idempotente. Rode depois da v99.

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
        'author_name', case
          when coalesce(us.state->'publicProfile'->>'hidden', '') in ('true', 't', '1') then 'Colega da Comunidade'
          else coalesce(nullif(trim(left(us.state->'publicProfile'->>'name', 60)), ''), 'Colega da Comunidade')
        end
      )
      order by d.created_at desc
    ),
    '[]'::jsonb
  )
  into v_docs
  from public.study_documents d
  left join public.study_campaigns sc on sc.id = d.campaign_id
  left join public.user_state us on us.user_id = d.user_id
  where d.processing_status = 'ready'
    and d.document_type not in ('edital', 'edital_concurso')
    and coalesce(d.title, '') !~* '\m(edital\s+verticalizado|edital\s+esquematizado|edital\s+sintetizado|edital\s+do\s+concurso|edital\s+de\s+abertura|edital\s+n[ºo°]|conte[uú]do\s+program[aá]tico\s+verticalizado)\M'
    and coalesce(d.source_name, '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
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
      and coalesce(g.title, '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
      and coalesce(g.content->>'source', '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
      and sd.id is not null
      and sd.document_type not in ('edital', 'edital_concurso')
      and coalesce(sd.title, '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
      and coalesce(sd.share_with_community, true) = true
      and coalesce(sd.metadata->>'private_only', 'false') <> 'true'
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

-- Conferência: nenhum documento compartilhado deve devolver nome do cadastro.
-- select jsonb_path_query_array(public.get_community_exam_library('', ''), '$.documents[*].author_name');


-- ============================================================================
-- COMPLEMENTO v100 (r126): INTEGRIDADE SERVER_VERIFIED E DUELO X1 DE 60s
-- ============================================================================

alter table if exists public.study_documents
  add column if not exists server_verified boolean not null default true;

alter table if exists public.generated_study_content
  add column if not exists server_verified boolean not null default true;

create or replace function public.enforce_community_content_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q jsonb;
  v_opts jsonb;
  v_ans int;
begin
  new.server_verified := true;
  if tg_table_name = 'generated_study_content' and new.content_type = 'questions' then
    if jsonb_typeof(new.content_json) = 'array' and jsonb_array_length(new.content_json) > 0 then
      for v_q in select * from jsonb_array_elements(new.content_json)
      loop
        v_opts := coalesce(v_q->'options', '[]'::jsonb);
        v_ans := coalesce((v_q->>'answer')::int, -1);
        if jsonb_typeof(v_opts) <> 'array'
           or jsonb_array_length(v_opts) < 2
           or jsonb_array_length(v_opts) > 5
           or v_ans < 0
           or v_ans >= jsonb_array_length(v_opts) then
          new.server_verified := false;
        end if;
      end loop;
    else
      new.server_verified := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_generated_content_integrity on public.generated_study_content;
create trigger trg_enforce_generated_content_integrity
  before insert or update on public.generated_study_content
  for each row execute function public.enforce_community_content_integrity();

create or replace function public.submit_hunter_duel_round(
  p_duel_id uuid,
  p_answers jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_duel public.hunter_duels%rowtype;
  v_q jsonb;
  v_a jsonb;
  v_idx int;
  v_n int;
  v_chosen int;
  v_correct int;
  v_time int;
  v_score int := 0;
  v_total_time int := 0;
  v_answered int := 0;
  v_xp_delta int := 0;
  v_winner uuid := null;
  v_both_done boolean := false;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória para submeter rodada de duelo.';
  end if;

  perform public.assert_rate_limit('submit_hunter_duel_round', 15, 60);

  select * into v_duel
  from public.hunter_duels
  where id = p_duel_id
  for update;

  if not found then
    raise exception 'Duelo não encontrado.';
  end if;

  if v_uid <> v_duel.challenger_id and v_uid <> v_duel.opponent_id then
    raise exception 'Apenas participantes do duelo podem enviar respostas.';
  end if;

  if v_uid = v_duel.challenger_id and v_duel.challenger_finished_at is not null then
    return to_jsonb(v_duel);
  end if;
  if v_uid = v_duel.opponent_id and v_duel.opponent_finished_at is not null then
    return to_jsonb(v_duel);
  end if;

  if jsonb_typeof(v_duel.questions_json) <> 'array' or jsonb_array_length(v_duel.questions_json) = 0 then
    raise exception 'Duelo sem caderno de questões no servidor.';
  end if;

  v_n := jsonb_array_length(v_duel.questions_json);

  if p_answers is not null and jsonb_typeof(p_answers) = 'array' then
    for v_idx in 0 .. least(v_n - 1, jsonb_array_length(p_answers) - 1) loop
      v_q := v_duel.questions_json -> v_idx;
      v_a := p_answers -> v_idx;
      v_correct := coalesce((v_q->>'answer')::int, -99);
      v_chosen := public.safe_int(v_a->>'chosen', -2, 4);
      v_time := public.safe_int(v_a->>'time_s', 1, 60);
      v_total_time := v_total_time + v_time;
      v_answered := v_answered + 1;
      if v_chosen = v_correct then
        v_score := v_score + 1;
      end if;
    end loop;
  end if;

  if v_answered < v_n then
    v_total_time := v_total_time + ((v_n - v_answered) * 60);
  end if;

  if v_uid = v_duel.challenger_id then
    v_duel.challenger_score := v_score;
    v_duel.challenger_time_s := v_total_time;
    v_duel.challenger_finished_at := timezone('utc', now());
  else
    v_duel.opponent_score := v_score;
    v_duel.opponent_time_s := v_total_time;
    v_duel.opponent_finished_at := timezone('utc', now());
  end if;

  v_both_done := (v_duel.challenger_finished_at is not null and v_duel.opponent_finished_at is not null);

  if v_both_done then
    v_duel.status := 'completed';
    if v_duel.challenger_score > v_duel.opponent_score then
      v_winner := v_duel.challenger_id;
    elsif v_duel.opponent_score > v_duel.challenger_score then
      v_winner := v_duel.opponent_id;
    elsif v_duel.challenger_time_s < v_duel.opponent_time_s then
      v_winner := v_duel.challenger_id;
    elsif v_duel.opponent_time_s < v_duel.challenger_time_s then
      v_winner := v_duel.opponent_id;
    else
      v_winner := null;
    end if;
    v_duel.winner_id := v_winner;
  end if;

  update public.hunter_duels
  set
    challenger_score = v_duel.challenger_score,
    challenger_time_s = v_duel.challenger_time_s,
    challenger_finished_at = v_duel.challenger_finished_at,
    opponent_score = v_duel.opponent_score,
    opponent_time_s = v_duel.opponent_time_s,
    opponent_finished_at = v_duel.opponent_finished_at,
    status = v_duel.status,
    winner_id = v_duel.winner_id,
    updated_at = timezone('utc', now())
  where id = p_duel_id
  returning * into v_duel;

  v_xp_delta := least(250, greatest(10, v_score * 25));
  perform public.grant_server_xp(
    v_uid,
    null,
    v_xp_delta,
    'duel_round',
    'duel:' || p_duel_id::text || ':' || v_uid::text
  );

  return to_jsonb(v_duel);
end;
$$;

grant execute on function public.submit_hunter_duel_round(uuid, jsonb, text) to authenticated;
