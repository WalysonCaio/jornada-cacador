-- Migração v79: Catálogo Compartilhado de Questões Oficiais e Pacotes de Prova (Multiusuário)
-- Permite que questões extraídas de provas oficiais ou importadas sejam compartilhadas
-- entre todos os usuários autenticados do projeto, sem duplicar consumo de IA.

create table if not exists public.shared_question_bank (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  subject text not null default 'Conteúdo Geral',
  topic text not null default 'Geral',
  board text not null default 'Banca Oficial',
  exam_year integer,
  exam_title text,
  difficulty text not null default 'medio' check (difficulty in ('facil', 'medio', 'dificil')),
  origin text not null default 'oficial' check (origin in ('oficial', 'adaptada_do_pdf', 'autoral')),
  statement text not null,
  options jsonb not null,
  correct_index integer not null check (correct_index >= 0 and correct_index <= 3),
  explanation text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shared_question_bank_subject on public.shared_question_bank (subject);
create index if not exists idx_shared_question_bank_board on public.shared_question_bank (board);
create index if not exists idx_shared_question_bank_origin on public.shared_question_bank (origin);

alter table public.shared_question_bank enable row level security;

drop policy if exists "Usuários autenticados leem banco compartilhado de questões" on public.shared_question_bank;
create policy "Usuários autenticados leem banco compartilhado de questões"
  on public.shared_question_bank
  for select
  to authenticated
  using (true);

drop policy if exists "Usuários autenticados contribuem questões oficiais" on public.shared_question_bank;
create policy "Usuários autenticados contribuem questões oficiais"
  on public.shared_question_bank
  for insert
  to authenticated
  with check (auth.uid() = created_by or created_by is null);
