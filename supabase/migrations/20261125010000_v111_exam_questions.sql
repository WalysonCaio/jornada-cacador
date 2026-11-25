-- v111: tabela estruturada public.exam_questions para centralizar e validar questões
-- Regras obrigatórias:
--   1. Nada destrutivo: sem DROP, DELETE ou TRUNCATE em tabelas existentes.
--   2. RLS ativado e fail-closed (share_with_community default false).
--   3. Preserva privacidade de PDFs com share_with_community = false (ou private_only = true / editais).
--   4. Permite correct_index NULL para questões com answer_unknown = true ou sem gabarito confirmado.
--   5. Nunca sobrescreve correct_index já existente em conflitos de fingerprint.

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid references public.study_campaigns(id) on delete set null,
  document_id uuid references public.study_documents(id) on delete set null,
  share_with_community boolean not null default false,

  board text not null default 'Não informada',
  exam_year integer check (exam_year is null or (exam_year >= 1980 and exam_year <= 2100)),
  exam_title text,
  question_number text,

  source_page integer check (source_page is null or source_page >= 0),
  source_question_number text,
  source_document_title text,
  quality_status text,

  subject text not null default 'Conteúdo Geral',
  topic text not null default 'Geral',
  statement text not null,
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) >= 2
    and jsonb_array_length(options) <= 5
  ),

  correct_index integer check (correct_index is null or (correct_index >= 0 and correct_index <= 4)),
  answer_unknown boolean not null default false,
  raw_key_source text,
  gabarito_source text not null default 'desconhecido' check (
    gabarito_source in ('oficial_pdf', 'colado', 'manual_revisado', 'ia', 'desconhecido')
  ),
  explanation text not null default '',
  origin text not null default 'desconhecida',

  source_table text not null default 'generated_study_content' check (
    source_table in ('generated_study_content', 'shared_question_bank', 'manual')
  ),
  source_row_id uuid,
  fingerprint text not null unique,

  status_validacao text not null default 'pendente' check (
    status_validacao in ('pendente', 'verificada', 'divergente')
  ),
  resposta_ia integer check (resposta_ia is null or (resposta_ia >= 0 and resposta_ia <= 4)),
  fundamento_ia text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_exam_questions_user_id on public.exam_questions (user_id);
create index if not exists idx_exam_questions_document_id on public.exam_questions (document_id);
create index if not exists idx_exam_questions_campaign_id on public.exam_questions (campaign_id);
create index if not exists idx_exam_questions_subject on public.exam_questions (subject);
create index if not exists idx_exam_questions_board on public.exam_questions (board);
create index if not exists idx_exam_questions_status_validacao on public.exam_questions (status_validacao);
create index if not exists idx_exam_questions_gabarito_source on public.exam_questions (gabarito_source);
create index if not exists idx_exam_questions_community on public.exam_questions (share_with_community) where share_with_community = true;

create or replace function public.exam_questions_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.answer_unknown is true then
    new.correct_index := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exam_questions_touch_updated_at on public.exam_questions;
create trigger trg_exam_questions_touch_updated_at
  before insert or update on public.exam_questions
  for each row
  execute function public.exam_questions_touch_updated_at();

alter table public.exam_questions enable row level security;

revoke all on public.exam_questions from public, anon;
grant select, insert, update on public.exam_questions to authenticated;
grant all on public.exam_questions to service_role;

drop policy if exists "exam_questions_owner_select" on public.exam_questions;
create policy "exam_questions_owner_select"
  on public.exam_questions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "exam_questions_community_select" on public.exam_questions;
create policy "exam_questions_community_select"
  on public.exam_questions
  for select
  to authenticated
  using (
    share_with_community = true
    and (
      (
        document_id is not null
        and exists (
          select 1
          from public.study_documents d
          where d.id = exam_questions.document_id
            and coalesce(d.share_with_community, false) = true
            and coalesce((d.metadata->>'private_only')::boolean, false) = false
            and coalesce(d.document_type, '') not in ('edital', 'edital_concurso')
        )
      )
      or (
        document_id is null
        and source_table = 'shared_question_bank'
      )
    )
  );

drop policy if exists "exam_questions_owner_insert" on public.exam_questions;
create policy "exam_questions_owner_insert"
  on public.exam_questions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "exam_questions_owner_update" on public.exam_questions;
create policy "exam_questions_owner_update"
  on public.exam_questions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
