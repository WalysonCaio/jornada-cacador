-- v116: sync automático para public.exam_questions (requer v115 aplicada).
-- Porta para SQL as regras de scripts/migrate-exam-questions.mjs (normalizeText, normalizeOptions,
-- computeFallbackFingerprint, mapGabaritoSource, isDocumentCommunityShared). Conferido contra o banco:
-- o fingerprint de fallback recalculado em SQL bate com 2.547 de 2.547 linhas 'fp_%'.
-- Chave de deduplicação = content_hash (o _fp do front NÃO é estável: a mesma questão tem _fp diferentes).
-- Regras de segurança: nunca sobrescreve gabarito travado (verificada/manual_revisado), nada é apagado,
-- e qualquer falha de sync vira WARNING (nunca derruba a gravação do conteúdo original).

-- ───────────── 1) Funções auxiliares (espelham o .mjs) ─────────────
create or replace function public.exam_js_trim(p text) returns text language sql immutable as $fn$
  select regexp_replace(coalesce(p, ''),
    E'^[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+|[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+$',
    '', 'g')
$fn$;

-- normalizeText: NFC + espaços colapsados + trim (conjunto de espaços idêntico ao \s do JavaScript)
create or replace function public.exam_normalize_text(p text) returns text language sql immutable as $fn$
  select btrim(regexp_replace(normalize(coalesce(p, ''), NFC),
    E'[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]+', ' ', 'g'), ' ')
$fn$;

-- normalizeOptions: string -> trim; objeto -> text ?? label ?? value; remove vazias; no máximo 5
create or replace function public.exam_normalize_options(p jsonb) returns jsonb language sql immutable as $fn$
  select coalesce(jsonb_agg(to_jsonb(v) order by ord), '[]'::jsonb)
  from (
    select ord, v from (
      select ord,
        case jsonb_typeof(e)
          when 'string' then public.exam_js_trim(e #>> '{}')
          when 'object' then public.exam_js_trim(coalesce(e->>'text', e->>'label', e->>'value', ''))
          when 'null'   then ''
          else public.exam_js_trim(e #>> '{}')
        end as v
      from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
           with ordinality as x(e, ord)
    ) s
    where length(v) > 0
    order by ord
    limit 5
  ) t
$fn$;

-- computeFallbackFingerprint: 'fp_' + sha256(JSON.stringify([enunciado, [alternativas]]) em minúsculas)[0:32]
create or replace function public.exam_fallback_fingerprint(p_statement text, p_options jsonb)
returns text language sql immutable as $fn$
  select 'fp_' || left(encode(sha256(convert_to(
    '[' || to_json(lower(public.exam_normalize_text(p_statement)))::text || ',[' ||
    coalesce((select string_agg(to_json(lower(public.exam_normalize_text(o)))::text, ',' order by ord)
              from jsonb_array_elements_text(
                     case when jsonb_typeof(p_options) = 'array' then p_options else '[]'::jsonb end
                   ) with ordinality as x(o, ord)), '') || ']]', 'UTF8')), 'hex'), 32)
$fn$;

-- mapGabaritoSource
create or replace function public.exam_map_gabarito_source(p text) returns text language sql immutable as $fn$
  select case lower(public.exam_normalize_text(p))
    when 'ia_sugerido' then 'ia' when 'ia' then 'ia' when 'ai' then 'ia'
    when 'gemini' then 'ia' when 'ai_suggested' then 'ia'
    when 'manual_revisado' then 'manual_revisado' when 'manual' then 'manual_revisado'
    when 'colado' then 'colado'
    else 'desconhecido'   -- vazio, sem_gabarito, unknown, desconhecido e qualquer outro valor
  end
$fn$;

create or replace function public.exam_gabarito_rank(p text) returns int language sql immutable as $fn$
  select case p when 'oficial_pdf' then 4 when 'manual_revisado' then 4 when 'colado' then 3
                when 'ia' then 2 else 1 end
$fn$;

-- isDocumentCommunityShared (documento ausente => false; o chamador cuida disso)
create or replace function public.exam_is_document_community_shared(p_type text, p_share boolean, p_meta jsonb)
returns boolean language sql immutable as $fn$
  select case
    when lower(public.exam_normalize_text(p_type)) in ('edital', 'edital_concurso') then false
    when p_share is false then false
    when (p_meta -> 'private_only') = 'true'::jsonb then false
    when (p_meta -> 'share_with_community') = 'false'::jsonb then false
    else coalesce(p_share, false)
  end
$fn$;

create index if not exists exam_questions_document_ativas_idx
  on public.exam_questions (document_id) where superseded_at is null;

-- ───────────── 2) Ingestão de UMA questão (idempotente, por content_hash) ─────────────
-- Retorna: inserted | skipped | upgraded | revived | invalid | conflict
create or replace function public.exam_questions_ingest(
  p_source_table text, p_source_row_id uuid, p_user_id uuid, p_campaign_id uuid, p_document_id uuid,
  p_share boolean, p_fp text, p_board text, p_exam_year int, p_exam_title text, p_question_number text,
  p_subject text, p_topic text, p_origin text, p_statement text, p_options jsonb, p_correct_index int,
  p_raw_key_source text, p_quality_status text, p_explanation text, p_source_page int,
  p_source_document_title text, p_source_question_number text, p_answer_unknown boolean
) returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_stmt text; v_opts jsonb; v_hash text; v_fp text; v_fb text; v_gab text;
  v_unknown boolean; v_ci int; v_share boolean; v_locked boolean;
  v_ex public.exam_questions%rowtype; v_new_id uuid;
begin
  v_stmt := public.exam_normalize_text(p_statement);
  v_opts := public.exam_normalize_options(p_options);
  if v_stmt = '' or jsonb_array_length(v_opts) < 2 then return 'invalid'; end if;

  v_hash    := public.exam_question_content_hash(v_stmt, v_opts);
  v_share   := coalesce(p_share, false);
  v_unknown := coalesce(p_answer_unknown, false);
  v_ci := case when v_unknown then null
               when p_correct_index between 0 and jsonb_array_length(v_opts) - 1 then p_correct_index
               else null end;
  v_gab := public.exam_map_gabarito_source(p_raw_key_source);

  -- 1) Já existe cópia ATIVA equivalente? (mesmo dono e mesma campanha, ou ambas públicas)
  select * into v_ex from public.exam_questions q
   where q.content_hash = v_hash and q.superseded_at is null
     and ((q.user_id is not distinct from p_user_id and q.campaign_id is not distinct from p_campaign_id)
          or (q.share_with_community and v_share))
   order by (q.status_validacao = 'verificada' or q.gabarito_source = 'manual_revisado') desc,
            q.share_with_community desc, q.created_at, q.id
   limit 1;
  if found then
    v_locked := v_ex.status_validacao = 'verificada' or v_ex.gabarito_source = 'manual_revisado';
    if v_ex.document_id is null and p_document_id is not null
       and v_ex.user_id is not distinct from p_user_id then
      update public.exam_questions set document_id = p_document_id where id = v_ex.id;
    end if;
    if v_share and not v_ex.share_with_community
       and v_ex.user_id is not distinct from p_user_id
       and v_ex.campaign_id is not distinct from p_campaign_id then
      update public.exam_questions set share_with_community = true where id = v_ex.id;
    end if;
    -- Só melhora gabarito NÃO travado, e só quando a nova origem é mais confiável (colado/oficial > ia > desconhecido)
    if not v_locked and v_ci is not null
       and public.exam_gabarito_rank(v_gab) > public.exam_gabarito_rank(v_ex.gabarito_source) then
      update public.exam_questions
         set correct_index = v_ci, gabarito_source = v_gab, answer_unknown = false,
             status_validacao = 'pendente', raw_key_source = coalesce(p_raw_key_source, raw_key_source)
       where id = v_ex.id;
      return 'upgraded';
    end if;
    return 'skipped';
  end if;

  -- 2) Cópia substituída por reextração (sem canônica) que voltou a existir? Reativa e preserva a validação.
  select * into v_ex from public.exam_questions q
   where q.content_hash = v_hash and q.superseded_at is not null and q.superseded_by is null
     and ((q.user_id is not distinct from p_user_id and q.campaign_id is not distinct from p_campaign_id)
          or (q.share_with_community and v_share))
   order by q.created_at, q.id limit 1;
  if found then
    update public.exam_questions set superseded_at = null, superseded_by = null where id = v_ex.id;
    return 'revived';
  end if;

  -- 3) Insere. Fingerprint: _fp se estiver livre; senão o de fallback (por conteúdo); senão fallback + sufixo do dono.
  v_fb := public.exam_fallback_fingerprint(v_stmt, v_opts);
  v_fp := coalesce(nullif(public.exam_normalize_text(p_fp), ''), v_fb);
  if exists (select 1 from public.exam_questions where fingerprint = v_fp) then v_fp := v_fb; end if;
  if exists (select 1 from public.exam_questions where fingerprint = v_fp) then
    v_fp := v_fb || '_' || left(md5(coalesce(p_user_id::text, '') || coalesce(p_campaign_id::text, '')), 8);
  end if;

  insert into public.exam_questions (
    user_id, campaign_id, document_id, board, exam_year, exam_title, question_number, subject, topic, origin,
    statement, options, correct_index, gabarito_source, explanation, fingerprint, answer_unknown, quality_status,
    raw_key_source, source_page, source_document_title, source_question_number, source_row_id, source_table,
    share_with_community, content_hash
  ) values (
    p_user_id, p_campaign_id, p_document_id,
    coalesce(nullif(public.exam_normalize_text(p_board), ''), 'Não informada'),
    p_exam_year, nullif(public.exam_normalize_text(p_exam_title), ''),
    nullif(public.exam_normalize_text(p_question_number), ''),
    coalesce(nullif(public.exam_normalize_text(p_subject), ''), 'Conteúdo Geral'),
    coalesce(nullif(public.exam_normalize_text(p_topic), ''), 'Geral'),
    coalesce(nullif(public.exam_normalize_text(p_origin), ''), 'desconhecida'),
    v_stmt, v_opts, v_ci, v_gab, public.exam_normalize_text(p_explanation), v_fp, v_unknown,
    nullif(public.exam_normalize_text(p_quality_status), ''), nullif(public.exam_normalize_text(p_raw_key_source), ''),
    p_source_page, nullif(public.exam_normalize_text(p_source_document_title), ''),
    nullif(public.exam_normalize_text(p_source_question_number), ''), p_source_row_id, p_source_table,
    v_share, v_hash
  ) on conflict (fingerprint) do nothing
  returning id into v_new_id;

  return case when v_new_id is null then 'conflict' else 'inserted' end;
end $fn$;

-- ───────────── 3) Mapeamento de uma linha de origem ─────────────
create or replace function public.exam_questions_sync_gsc_row(g public.generated_study_content)
returns text[] language plpgsql security definer set search_path = public as $fn$
declare
  v_dtype text; v_dshare boolean; v_dmeta jsonb; v_dtitle text;
  v_share boolean := false; e jsonb; res text[] := '{}';
  v_year int; v_ci int; v_page int;
begin
  if jsonb_typeof(g.content -> 'questions') is distinct from 'array' then return res; end if;
  if g.source_document_id is not null then
    select document_type, share_with_community, metadata, title
      into v_dtype, v_dshare, v_dmeta, v_dtitle
      from public.study_documents where id = g.source_document_id;
    if found then
      v_share := public.exam_is_document_community_shared(v_dtype, v_dshare, v_dmeta);
    end if;
  end if;

  for e in select value from jsonb_array_elements(g.content -> 'questions') loop
    continue when jsonb_typeof(e) is distinct from 'object';
    v_year := case when e->>'exam_year' ~ '^\d{4}$'
                   then case when (e->>'exam_year')::int between 1980 and 2100 then (e->>'exam_year')::int end end;
    v_ci   := case when e->>'correct_index' ~ '^\d{1,2}$' then (e->>'correct_index')::int end;
    v_page := case when e->>'source_page' ~ '^\d{1,6}$' then (e->>'source_page')::int end;
    res := res || public.exam_questions_ingest(
      'generated_study_content', g.id, g.user_id, g.campaign_id, g.source_document_id, v_share,
      coalesce(nullif(e->>'_fp', ''), e->>'fingerprint'),
      e->>'board', v_year, g.title, e->>'question_number',
      coalesce(nullif(e->>'subject', ''), g.content->>'subject'), e->>'topic', e->>'origin',
      coalesce(e->>'statement', e->>'question', e->>'enunciado'), e->'options', v_ci,
      e->>'key_source', e->>'quality_status', e->>'explanation', v_page,
      coalesce(nullif(e->>'source_document_title', ''), nullif(g.content->>'source', ''), v_dtitle),
      e->>'source_question_number', (e->'answer_unknown') = 'true'::jsonb
    );
  end loop;
  return res;
end $fn$;

create or replace function public.exam_questions_sync_sqb_row(s public.shared_question_bank)
returns text language sql security definer set search_path = public as $fn$
  select public.exam_questions_ingest(
    'shared_question_bank', s.id, s.created_by, null, null, true, s.fingerprint, s.board, s.exam_year,
    s.exam_title, null, s.subject, s.topic, s.origin, s.statement, s.options, s.correct_index,
    null, null, s.explanation, null, null, null, false)
$fn$;

-- ───────────── 4) Reconciliação por documento (reextração não apaga: marca substituída) ─────────────
create or replace function public.exam_questions_reconcile_document(p_doc uuid) returns int
language plpgsql security definer set search_path = public as $fn$
declare v_n int;
begin
  if p_doc is null then return 0; end if;
  with vivos as (
    select distinct public.exam_question_content_hash(
             public.exam_normalize_text(coalesce(e->>'statement', e->>'question', e->>'enunciado')),
             public.exam_normalize_options(e->'options')) as h
    from public.generated_study_content g,
         lateral jsonb_array_elements(
           case when jsonb_typeof(g.content -> 'questions') = 'array' then g.content -> 'questions' else '[]'::jsonb end) e
    where g.source_document_id = p_doc and jsonb_typeof(e) = 'object'
  ), sup as (
    update public.exam_questions q set superseded_at = now(), superseded_by = null
     where q.document_id = p_doc and q.source_table = 'generated_study_content' and q.superseded_at is null
       and q.content_hash not in (select h from vivos)
    returning q.id
  ), rev as (   -- cópias que dependiam de uma canônica que sumiu voltam a ficar ativas
    update public.exam_questions d set superseded_at = null, superseded_by = null
      from sup where d.superseded_by = sup.id
    returning d.id
  )
  select (select count(*) from sup) into v_n;
  return v_n;
end $fn$;

-- ───────────── 5) Triggers (todos à prova de falha) ─────────────
create or replace function public.trg_exam_questions_from_gsc() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  perform set_config('app.exam_sync', 'on', true);
  begin
    perform public.exam_questions_sync_gsc_row(new);
    if new.source_document_id is not null then
      perform public.exam_questions_reconcile_document(new.source_document_id);
    end if;
    if tg_op = 'UPDATE' and old.source_document_id is not null
       and old.source_document_id is distinct from new.source_document_id then
      perform public.exam_questions_reconcile_document(old.source_document_id);
    end if;
  exception when others then
    raise warning 'exam_questions sync (generated_study_content %): %', new.id, sqlerrm;
  end;
  perform set_config('app.exam_sync', '', true);
  return null;
end $fn$;

create or replace function public.trg_exam_questions_from_gsc_delete() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  perform set_config('app.exam_sync', 'on', true);
  begin
    if old.source_document_id is not null then
      perform public.exam_questions_reconcile_document(old.source_document_id);
    end if;
  exception when others then
    raise warning 'exam_questions reconcile (delete %): %', old.id, sqlerrm;
  end;
  perform set_config('app.exam_sync', '', true);
  return null;
end $fn$;

create or replace function public.trg_exam_questions_from_sqb() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  perform set_config('app.exam_sync', 'on', true);
  begin
    perform public.exam_questions_sync_sqb_row(new);
  exception when others then
    raise warning 'exam_questions sync (shared_question_bank %): %', new.id, sqlerrm;
  end;
  perform set_config('app.exam_sync', '', true);
  return null;
end $fn$;

-- Mudou o compartilhamento do documento: a visibilidade das questões acompanha (e desfaz substituições
-- feitas por uma cópia que deixou de ser pública, para ninguém ficar sem enxergar a questão).
create or replace function public.trg_exam_questions_doc_share() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_share boolean;
begin
  perform set_config('app.exam_sync', 'on', true);
  begin
    v_share := public.exam_is_document_community_shared(new.document_type, new.share_with_community, new.metadata);
    update public.exam_questions
       set share_with_community = v_share
     where document_id = new.id and source_table = 'generated_study_content'
       and share_with_community is distinct from v_share;
    if not v_share then
      update public.exam_questions r set superseded_at = null, superseded_by = null
        from public.exam_questions c
       where r.superseded_by = c.id and c.document_id = new.id and not c.share_with_community
         and r.user_id is distinct from c.user_id;
    end if;
  exception when others then
    raise warning 'exam_questions share sync (study_documents %): %', new.id, sqlerrm;
  end;
  perform set_config('app.exam_sync', '', true);
  return null;
end $fn$;

drop trigger if exists trg_exam_questions_from_gsc on public.generated_study_content;
create trigger trg_exam_questions_from_gsc
  after insert or update of content, source_document_id on public.generated_study_content
  for each row execute function public.trg_exam_questions_from_gsc();

drop trigger if exists trg_exam_questions_from_gsc_delete on public.generated_study_content;
create trigger trg_exam_questions_from_gsc_delete
  after delete on public.generated_study_content
  for each row execute function public.trg_exam_questions_from_gsc_delete();

drop trigger if exists trg_exam_questions_from_sqb on public.shared_question_bank;
create trigger trg_exam_questions_from_sqb
  after insert or update on public.shared_question_bank
  for each row execute function public.trg_exam_questions_from_sqb();

drop trigger if exists trg_exam_questions_doc_share on public.study_documents;
create trigger trg_exam_questions_doc_share
  after update of share_with_community, metadata, document_type on public.study_documents
  for each row
  when (old.share_with_community is distinct from new.share_with_community
     or old.metadata is distinct from new.metadata
     or old.document_type is distinct from new.document_type)
  execute function public.trg_exam_questions_doc_share();

-- ───────────── 6) Backfill único e idempotente (NÃO roda sozinho) ─────────────
create or replace function public.exam_questions_backfill_missing() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  g public.generated_study_content; s public.shared_question_bank;
  r text; cnt jsonb := '{}'::jsonb;
begin
  perform set_config('app.exam_sync', 'on', true);
  for g in select * from public.generated_study_content
           where jsonb_typeof(content -> 'questions') = 'array' loop
    foreach r in array public.exam_questions_sync_gsc_row(g) loop
      cnt := jsonb_set(cnt, array[r], to_jsonb(coalesce((cnt->>r)::int, 0) + 1));
    end loop;
  end loop;
  for s in select * from public.shared_question_bank loop
    r := public.exam_questions_sync_sqb_row(s);
    cnt := jsonb_set(cnt, array[r], to_jsonb(coalesce((cnt->>r)::int, 0) + 1));
  end loop;
  perform set_config('app.exam_sync', '', true);
  return cnt;
end $fn$;

-- Funções internas: só service_role (os triggers rodam como dono da função e não dependem disto)
revoke all on function public.exam_questions_ingest(text,uuid,uuid,uuid,uuid,boolean,text,text,int,text,text,text,text,text,text,jsonb,int,text,text,text,int,text,text,boolean) from public, anon, authenticated;
revoke all on function public.exam_questions_sync_gsc_row(public.generated_study_content) from public, anon, authenticated;
revoke all on function public.exam_questions_sync_sqb_row(public.shared_question_bank) from public, anon, authenticated;
revoke all on function public.exam_questions_reconcile_document(uuid) from public, anon, authenticated;
revoke all on function public.exam_questions_backfill_missing() from public, anon, authenticated;
grant execute on function public.exam_questions_backfill_missing() to service_role;

-- ───────────── Testes de aceite (rode no SQL Editor) ─────────────
-- A) Paridade com o .mjs (somente leitura). Esperado: batem = total = 2547
-- select count(*) as total,
--        count(*) filter (where public.exam_fallback_fingerprint(statement, options) = fingerprint) as batem
-- from public.exam_questions where fingerprint ~ '^fp_[0-9a-f]{32}$';
--
-- B) Backfill. 1ª execução: espera-se inserted ≈ 22 (variantes com o MESMO enunciado e alternativas diferentes que
--    o _fp antigo fundiu e o backfill do .mjs descartou) e o resto skipped. 2ª execução: inserted = 0.
-- select count(*) from public.exam_questions;                 -- antes
-- select public.exam_questions_backfill_missing();
-- select count(*) from public.exam_questions;                 -- depois
-- select public.exam_questions_backfill_missing();            -- tem que voltar sem 'inserted'
--
-- C) Sync não duplica (rollback no fim). Esperado: antes = depois
-- begin;
-- select count(*) as antes from public.exam_questions;
-- update public.generated_study_content set content = content
--  where id = (select id from public.generated_study_content where jsonb_typeof(content->'questions') = 'array' limit 1);
-- select count(*) as depois from public.exam_questions;
-- rollback;
--
-- D) INFORMATIVO — 59 questões estão privadas, mas o documento de origem (simulado) está marcado como compartilhado.
--    A v116 NÃO muda isso sozinha (só reage a mudanças futuras) para não tornar nada público sem decisão sua:
-- select count(*) from public.exam_questions q join public.study_documents d on d.id = q.document_id
--  where q.source_table = 'generated_study_content' and not q.share_with_community
--    and public.exam_is_document_community_shared(d.document_type, d.share_with_community, d.metadata);
