-- v101: CONTEÚDO COMUNITÁRIO SÓ SE FOR VERIFICADO PELO SERVIDOR
-- Problema: study_documents e generated_study_content aceitam INSERT/UPDATE direto do usuário (política
-- own_rows_all). Alguém mal-intencionado podia criar um material com gabarito errado e a biblioteca comunitária
-- o mostrava a todos. O complemento da v100 tentou resolver, mas (a) referenciava colunas/funções que não existem
-- (content_json, questions_json, assert_rate_limit, grant_server_xp), (b) só olhava content_type = 'questions'
-- (o app grava 'summary' e 'question_pack'), (c) forçava server_verified := true sempre e (d) nada lia a coluna.
-- Agora: só o servidor (service_role) ou o administrador do banco liga server_verified; o usuário não consegue
-- ligar nem desligar. A biblioteca só devolve documentos e conteúdos verificados.
--
-- ORDEM: faça o deploy da função material-gemini ANTES (ela passa a gravar server_verified = true quando termina
-- de processar). Material novo importado direto pelo navegador (ex.: extrator de provas) fica privado.
-- Linhas que já existiam continuam verificadas (a v100 as criou com valor true).

-- 1) remove o que o complemento da v100 deixou (se foi executado)
drop function if exists public.submit_hunter_duel_round(uuid, jsonb, text);
drop trigger if exists trg_enforce_generated_content_integrity on public.generated_study_content;
drop function if exists public.enforce_community_content_integrity();

-- 2) novos registros nascem NÃO verificados
alter table if exists public.study_documents alter column server_verified set default false;
alter table if exists public.generated_study_content alter column server_verified set default false;

-- 3) somente o servidor muda o campo
create or replace function public.protect_server_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''),
    ''
  );
begin
  if v_role = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.server_verified := false;
  else
    new.server_verified := old.server_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_server_verified on public.study_documents;
create trigger trg_protect_server_verified
  before insert or update on public.study_documents
  for each row execute function public.protect_server_verified();

drop trigger if exists trg_protect_server_verified on public.generated_study_content;
create trigger trg_protect_server_verified
  before insert or update on public.generated_study_content
  for each row execute function public.protect_server_verified();

-- 4) a biblioteca comunitária só devolve conteúdo verificado
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
    and coalesce(d.metadata->>'private_only', 'false') <> 'true'
    and coalesce(d.server_verified, false) = true;

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
      and coalesce(sd.server_verified, false) = true
      and coalesce(g.server_verified, false) = true
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


-- 5) Duelo X1 passou a ter 60 s por pergunta: o servidor limitava o tempo a 25 s (e punia pergunta não respondida com 25 s).
-- Mantém exatamente a função ativa (a de 4 parâmetros que o app chama), só ajustando o limite de tempo.
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
               public.safe_int(a->>'time_s', 1, 60) as tm
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

  v_time := greatest(1, v_time + 60 * (v_n - v_answered));
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

-- Conferências (rode manualmente):
-- select count(*) from public.study_documents where server_verified is not true;   -- documentos só do usuário
-- select proname from pg_proc where proname in ('assert_rate_limit','grant_server_xp');   -- (vazio: nunca existiram)
