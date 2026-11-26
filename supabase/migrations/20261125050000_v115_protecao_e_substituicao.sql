-- v115: (1) trava de gabaritos validados, (2) colunas de substituição (superseded),
-- (3) content_hash para detectar duplicatas por conteúdo, (4) fila de revisão sem substituídas.
-- Não destrutivo: nada é apagado. NÃO inclui os triggers de sync (ver nota no fim).

-- ───────────── 1) Colunas ─────────────
alter table public.exam_questions
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by uuid references public.exam_questions(id) on delete set null,
  add column if not exists content_hash text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'exam_questions_superseded_check') then
    alter table public.exam_questions
      add constraint exam_questions_superseded_check
      check (superseded_by is null or superseded_at is not null);
  end if;
end $$;

create index if not exists exam_questions_ativas_idx
  on public.exam_questions (id) where superseded_at is null;
create index if not exists exam_questions_content_hash_idx
  on public.exam_questions (content_hash);

-- ───────────── 2) content_hash (SQL, normalizado) ─────────────
-- Normaliza: minúsculas, sem acento, só [a-z0-9] separados por espaço. Hash = sha256(enunciado|alt1|alt2|...)
create or replace function public.exam_question_content_hash(p_statement text, p_options jsonb)
returns text language sql immutable as $$
  with n as (
    select
      trim(regexp_replace(lower(translate(coalesce(p_statement,''),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', ' ', 'g')) as st,
      coalesce((
        select string_agg(trim(regexp_replace(lower(translate(o,
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', ' ', 'g')), '|' order by ord)
        from jsonb_array_elements_text(
          case when jsonb_typeof(p_options) = 'array' then p_options else '[]'::jsonb end
        ) with ordinality as x(o, ord)
      ), '') as ops
  )
  select encode(sha256(convert_to(st || '|' || ops, 'UTF8')), 'hex') from n
$$;

-- Backfill do hash (roda como dono; a trava abaixo só age sobre sync e usuários do app)
update public.exam_questions
set content_hash = public.exam_question_content_hash(statement, options)
where content_hash is null;

-- Mantém o hash atualizado em novas linhas / mudanças de texto
create or replace function public.exam_questions_set_content_hash()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.statement is distinct from old.statement or new.options is distinct from old.options then
    new.content_hash := public.exam_question_content_hash(new.statement, new.options);
  end if;
  return new;
end $$;

drop trigger if exists trg_exam_questions_content_hash on public.exam_questions;
create trigger trg_exam_questions_content_hash
  before insert or update on public.exam_questions
  for each row execute function public.exam_questions_set_content_hash();

-- ───────────── 3) Trava de gabaritos validados ─────────────
-- Linha "travada": status 'verificada' OU gabarito_source 'manual_revisado'.
-- Em travadas, estes caminhos NÃO conseguem mudar correct_index, gabarito_source, status_validacao,
-- answer_unknown, statement e options:
--   a) funções de sync (que fazem set_config('app.exam_sync','on',true) antes de gravar): valores antigos
--      são mantidos em silêncio e o resto da gravação segue;
--   b) usuários do app (role anon/authenticated): erro explícito.
-- Edição manual no SQL Editor, service_role e a RPC save_question_validation continuam livres.
create or replace function public.exam_questions_protect_validated()
returns trigger language plpgsql as $$
declare
  v_role text;
  v_sync boolean;
  v_locked boolean;
  v_changed boolean;
begin
  v_locked := old.status_validacao = 'verificada' or old.gabarito_source = 'manual_revisado';
  if not v_locked then return new; end if;

  v_sync := coalesce(current_setting('app.exam_sync', true), '') = 'on';
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    ''
  );
  if not (v_sync or v_role in ('anon', 'authenticated')) then return new; end if;

  v_changed :=
       new.correct_index    is distinct from old.correct_index
    or new.gabarito_source  is distinct from old.gabarito_source
    or new.status_validacao is distinct from old.status_validacao
    or new.answer_unknown   is distinct from old.answer_unknown
    or new.statement        is distinct from old.statement
    or new.options          is distinct from old.options;
  if not v_changed then return new; end if;

  if v_role in ('anon', 'authenticated') and not v_sync then
    raise exception 'Gabarito validado/revisado: alteração bloqueada (questão %).', old.id
      using errcode = '42501';
  end if;

  new.correct_index    := old.correct_index;
  new.gabarito_source  := old.gabarito_source;
  new.status_validacao := old.status_validacao;
  new.answer_unknown   := old.answer_unknown;
  new.statement        := old.statement;
  new.options          := old.options;
  return new;
end $$;

drop trigger if exists trg_exam_questions_protect_validated on public.exam_questions;
create trigger trg_exam_questions_protect_validated
  before update on public.exam_questions
  for each row execute function public.exam_questions_protect_validated();

-- ───────────── 4) Fila de revisão sem substituídas (mesmas colunas da v114) ─────────────
create or replace view public.exam_questions_review_queue
with (security_invoker = true) as
select
  q.id,
  case
    when q.status_validacao = 'divergente'                                   then 'divergente_ia'
    when q.correct_index is null and q.resposta_ia is not null                then 'sem_gabarito_com_ia'
    when q.validation_error like 'passes_divergentes%'                        then 'passes_divergentes'
    when q.validation_error = 'ambigua'                                       then 'ambigua'
    when q.validation_error in ('itens_ou_texto_base_ausentes','sem_comando')
      or q.validation_error like 'passe2:%'                                   then 'incompleta_segundo_ia'
    when q.validation_error like 'triagem:%'                                  then 'triagem_defeituosa'
  end as motivo,
  case
    when q.status_validacao = 'divergente'                                    then 1
    when q.correct_index is null and q.resposta_ia is not null                then 2
    when q.validation_error like 'passes_divergentes%'                        then 3
    when q.validation_error = 'ambigua'                                       then 4
    when q.validation_error in ('itens_ou_texto_base_ausentes','sem_comando')
      or q.validation_error like 'passe2:%'                                   then 5
    when q.validation_error like 'triagem:%'                                  then 6
  end as prioridade,
  q.ia_confianca as confianca,
  q.ia_model as modelo,
  (q.ia_model like 'groq:%') as modelo_fallback,
  q.board, q.subject,
  left(q.statement, 160) as enunciado,
  case when q.correct_index is null then null else chr(65 + q.correct_index) end as cadastrado,
  case when q.resposta_ia  is null then null else chr(65 + q.resposta_ia)  end as ia,
  q.gabarito_source,
  q.fundamento_ia,
  q.validation_error,
  q.validated_at
from public.exam_questions q
where q.superseded_at is null
  and (   q.status_validacao = 'divergente'
       or (q.correct_index is null and q.resposta_ia is not null)
       or q.validation_error like 'passes_divergentes%'
       or q.validation_error = 'ambigua'
       or q.validation_error in ('itens_ou_texto_base_ausentes','sem_comando')
       or q.validation_error like 'passe2:%'
       or q.validation_error like 'triagem:%');

revoke all on public.exam_questions_review_queue from anon;

-- ───────────── Testes de aceite (rode no SQL Editor; tudo termina em ROLLBACK) ─────────────
-- A) Sync não consegue mudar gabarito travado (deve devolver mudou = false):
-- begin;
-- select set_config('app.exam_sync','on',true);
-- with alvo as (select id, correct_index from public.exam_questions where status_validacao='verificada' limit 1),
--      u as (update public.exam_questions q set correct_index = (q.correct_index + 1) % 5
--            from alvo a where q.id = a.id returning q.id, q.correct_index as novo)
-- select (select novo from u) <> (select correct_index from alvo) as mudou;
-- rollback;
-- B) Hash preenchido em todas as linhas (deve dar 0):
-- select count(*) from public.exam_questions where content_hash is null;
-- C) Visão de duplicatas por conteúdo (informativo):
-- select count(*) filter (where n > 1) as grupos, sum(n - 1) filter (where n > 1) as excedentes
-- from (select content_hash, count(*) n from public.exam_questions where superseded_at is null group by 1) s;

-- ───────────── NOTA: triggers de sync NÃO estão aqui ─────────────
-- Os triggers em generated_study_content / shared_question_bank dependem da limpeza de enunciado/alternativas
-- e do fingerprint exatos de scripts/migrate-exam-questions.mjs, que eu não consegui ver. Eles virão na v116,
-- chamando set_config('app.exam_sync','on',true) e envolvidos em EXCEPTION WHEN OTHERS (falha de sync nunca
-- pode derrubar a gravação do conteúdo).
