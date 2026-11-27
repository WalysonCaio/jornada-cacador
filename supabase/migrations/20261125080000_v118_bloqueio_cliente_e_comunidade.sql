-- v118: (3) bloqueio de INSERT/UPDATE do cliente em colunas de validação e publicação de exam_questions;
--        (4) política de comunidade que funciona para documentos de outros usuários.
-- Escrita do servidor (sync com app.exam_sync = 'on', service_role, SQL Editor) continua livre.
-- Cliente = roles anon e authenticated (auth.role()).

-- ───────────── (3) Trigger de bloqueio do cliente ─────────────
-- Roda ANTES de todos os outros triggers BEFORE porque o nome começa com "trg_exam_questions_a_".
create or replace function public.exam_questions_block_client_writes()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_role text := coalesce(auth.role(), '');
begin
  -- servidor (sync) ou papéis que não são de cliente: permitido
  if coalesce(current_setting('app.exam_sync', true), '') = 'on' then return new; end if;
  if v_role not in ('anon', 'authenticated') then return new; end if;

  if tg_op = 'INSERT' then
    if new.correct_index is not null                                     -- gabarito preenchido pelo cliente
       or coalesce(new.gabarito_source, 'desconhecido') <> 'desconhecido'
       or coalesce(new.status_validacao, 'pendente') <> 'pendente'
       or coalesce(new.answer_unknown, false)
       or new.resposta_ia is not null
       or new.superseded_at is not null
       or coalesce(new.share_with_community, false)                       -- publicar só pelo fluxo de documento
       or coalesce(new.source_table, '') <> 'generated_study_content'
       or new.user_id is distinct from auth.uid() then
      raise exception 'Inserção direta com campos de validação ou publicação bloqueada'
        using errcode = '42501';
    end if;
    if new.document_id is not null and not exists (
      select 1 from public.study_documents d
      where d.id = new.document_id and d.user_id = auth.uid()
    ) then
      raise exception 'Documento de origem inválido para este usuário' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE pelo cliente: qualquer mudança nessas colunas é bloqueada
  if new.correct_index        is distinct from old.correct_index
     or new.gabarito_source   is distinct from old.gabarito_source
     or new.status_validacao  is distinct from old.status_validacao
     or new.answer_unknown    is distinct from old.answer_unknown
     or new.source_table      is distinct from old.source_table
     or new.document_id       is distinct from old.document_id
     or new.share_with_community is distinct from old.share_with_community then
    raise exception 'Campo de validação ou publicação só pode ser alterado pelo servidor'
      using errcode = '42501';
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_exam_questions_a_block_client_writes on public.exam_questions;
create trigger trg_exam_questions_a_block_client_writes
  before insert or update on public.exam_questions
  for each row execute function public.exam_questions_block_client_writes();

-- ───────────── (4) Política de comunidade com função SECURITY DEFINER ─────────────
-- A função lê study_documents sem o RLS do dono. Os critérios são os mesmos do RPC get_community_exam_library:
-- compartilhado, pronto no servidor, não private_only, não é edital (tipo ou título).
create or replace function public.exam_document_community_visible(p_doc uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.study_documents d
    where d.id = p_doc
      and coalesce(d.share_with_community, false) = true
      and coalesce(d.server_verified, false) = true
      and coalesce(d.metadata->>'private_only', 'false') <> 'true'
      and coalesce(d.document_type, '') not in ('edital', 'edital_concurso')
      and coalesce(d.title, '') !~* '\m(edital\s+verticalizado|edital\s+do\s+concurso|edital\s+de\s+abertura)\M'
  )
$fn$;

revoke all on function public.exam_document_community_visible(uuid) from public, anon;
grant execute on function public.exam_document_community_visible(uuid) to authenticated, service_role;

drop policy if exists exam_questions_community_select on public.exam_questions;
create policy exam_questions_community_select on public.exam_questions
  for select to authenticated
  using (
    share_with_community = true
    and superseded_at is null
    and (
      (document_id is not null and public.exam_document_community_visible(document_id))
      or (document_id is null and source_table = 'shared_question_bank')
    )
  );

-- ───────────── TESTES (rodar em um BRANCH do Supabase, não em produção) ─────────────
-- T1 (item 3) como o dono, com JWT de um usuário real, tentar mudar o gabarito de uma linha dele deve dar erro 42501:
--   update public.exam_questions set correct_index = 0 where id = '<id de uma linha sua>';
-- T2 (item 3) o sync continua funcionando: atualizar um generated_study_content e conferir que as linhas
--   de exam_questions são criadas (sem erro), como antes.
-- T3 (item 4) como um usuário que NÃO é dono, a contagem de questões comunitárias de PDFs deve ser > 0:
--   set local role authenticated; select set_config('request.jwt.claims','{"sub":"<uuid de outro usuário>","role":"authenticated"}',true);
--   select source_table, count(*) from public.exam_questions group by 1;
-- T4 (item 4) a contagem por essa política deve bater com o RPC get_community_exam_library (mesmos documentos).
