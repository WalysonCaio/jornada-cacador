-- v119: (13) grants excessivos; (8) ordem dos triggers de hash; (9) reconcile sem perda por ponteiro.
-- Não destrutivo. Nenhuma linha é apagada; o reconcile só marca substituição e reativa quando a origem ainda contém o conteúdo.

-- ───────────── (13) Grants ─────────────
-- anon não tem motivo para acessar essas tabelas (o RLS já bloqueia; isto é a segunda linha de defesa).
revoke all on table public.generated_study_content from anon;
revoke all on table public.shared_question_bank from anon;
revoke all on table public.study_documents from anon;

-- Views de fila: somente leitura. A escrita nelas passa pelo RLS da tabela base, mas não há motivo para existir.
revoke insert, update, delete on table public.exam_questions_review_queue from anon, authenticated;
revoke insert, update, delete on table public.exam_questions_review_final from anon, authenticated;
revoke all on table public.exam_questions_dedup_plan from anon, authenticated;

-- ───────────── (8) Ordem dos triggers BEFORE em exam_questions ─────────────
-- Antes: trg_exam_questions_content_hash rodava antes de trg_exam_questions_protect_validated (ordem alfabética),
-- então o hash era calculado sobre um texto que a trava podia reverter.
-- Agora o hash roda por último ("z"): trava (protect) -> touch_updated_at -> hash.
drop trigger if exists trg_exam_questions_content_hash on public.exam_questions;
drop trigger if exists trg_exam_questions_z_content_hash on public.exam_questions;
create trigger trg_exam_questions_z_content_hash
  before insert or update on public.exam_questions
  for each row execute function public.exam_questions_set_content_hash();

-- ───────────── (9) Reconcile com ponteiros corrigido ─────────────
-- Helpers: hashes presentes no JSON de um documento, e teste de presença.
create or replace function public.exam_doc_hashes(p_doc uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $fn$
  select public.exam_question_content_hash(
           public.exam_normalize_text(coalesce(e->>'statement', e->>'question', e->>'enunciado')),
           public.exam_normalize_options(e->'options'))
  from public.generated_study_content g,
       lateral jsonb_array_elements(
         case when jsonb_typeof(g.content->'questions') = 'array' then g.content->'questions' else '[]'::jsonb end
       ) e
  where g.source_document_id = p_doc
    and jsonb_typeof(e) = 'object'
$fn$;

create or replace function public.exam_doc_has_hash(p_doc uuid, p_hash text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.exam_doc_hashes(p_doc) h where h = p_hash)
$fn$;

revoke all on function public.exam_doc_hashes(uuid) from public, anon, authenticated;
revoke all on function public.exam_doc_has_hash(uuid, text) from public, anon, authenticated;

-- Antes, o CTE "rev" procurava superseded_by = sup.id depois que "sup" já tinha zerado superseded_by: nunca casava.
-- Agora as etapas são sequenciais e explícitas (sem dois UPDATEs na mesma linha dentro de um mesmo WITH):
--   1) marca como substituídas as cópias ativas do documento cujo conteúdo saiu do JSON;
--   2) cópias que apontavam para elas voltam a ser ativas se o próprio documento (ou a origem sem documento) ainda contém o conteúdo;
--   3) as que sobraram apontam para outra linha ativa com o mesmo conteúdo, se existir; senão ficam sem ponteiro.
create or replace function public.exam_questions_reconcile_document(p_doc uuid)
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids uuid[];
  v_n int := 0;
begin
  if p_doc is null then return 0; end if;

  select coalesce(array_agg(q.id), '{}') into v_ids
  from public.exam_questions q
  where q.document_id = p_doc
    and q.source_table = 'generated_study_content'
    and q.superseded_at is null
    and not public.exam_doc_has_hash(p_doc, q.content_hash);

  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then return 0; end if;

  -- 1) marca as cópias que saíram do documento
  update public.exam_questions
     set superseded_at = now(), superseded_by = null
   where id = any(v_ids);

  -- 2) reativa dependentes que ainda têm o conteúdo na própria origem
  update public.exam_questions d
     set superseded_at = null, superseded_by = null
   where d.superseded_by = any(v_ids)
     and d.superseded_at is not null
     and (d.document_id is null or public.exam_doc_has_hash(d.document_id, d.content_hash));

  -- 3) repontera os dependentes restantes para uma linha ativa com o mesmo conteúdo (ou fica sem ponteiro)
  update public.exam_questions d
     set superseded_by = (
       select a.id from public.exam_questions a
        where a.content_hash = d.content_hash and a.superseded_at is null
        order by a.created_at, a.id limit 1)
   where d.superseded_by = any(v_ids)
     and d.superseded_at is not null;

  return v_n;
end
$fn$;

-- ───────────── TESTES (rodar em um BRANCH do Supabase) ─────────────
-- R1 (item 9): escolha um documento com cópias de dedup. Dentro de begin/rollback, simule a remoção do conteúdo
--     de uma canônica e confira que nenhuma questão ficou sem linha ativa:
--   begin;
--   select public.exam_questions_reconcile_document('<uuid do documento>');
--   select count(*) from public.exam_questions d where d.superseded_at is not null and d.superseded_by is not null
--     and exists (select 1 from public.exam_questions b where b.id = d.superseded_by and b.superseded_at is not null);  -- deve dar 0
--   rollback;
-- R2 (item 8): atualizar uma linha travada (verificada) com statement alterado pelo sync não deixa content_hash
--   diferente de exam_question_content_hash(statement, options).
-- R3 (item 13): como anon, select em generated_study_content deve dar "permission denied".
