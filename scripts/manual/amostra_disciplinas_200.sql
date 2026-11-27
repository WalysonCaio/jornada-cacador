-- SCRIPT MANUAL — rodar DEPOIS da v120 aplicada. Não colocar em migrations.
-- Cria a tabela de revisão e uma amostra estratificada por disciplina atual (~200 linhas).
-- Não altera nenhuma questão. Você preenche subject_correto com a disciplina certa; depois medimos a precisão.

-- ───────────── PASSO 1 — tabela de revisão (sem acesso para anon/authenticated) ─────────────
create table if not exists public.amostra_disciplinas (
  question_id uuid primary key,
  subject_atual text,
  subject_origem text,
  enunciado text,
  subject_correto text,
  revisado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.amostra_disciplinas enable row level security;
revoke all on public.amostra_disciplinas from anon, authenticated;

-- ───────────── PASSO 2 — amostra (idempotente: só insere o que ainda não está na tabela) ─────────────
-- Proporcional ao tamanho de cada disciplina, com pelo menos 1 por disciplina; semente fixa para reproduzir.
-- Rótulos 'manual' ficam de fora: já foram revisados por humano.
-- Rode o bloco inteiro de uma vez (o setseed vale só para a sessão).
-- select setseed(0.2026);
-- insert into public.amostra_disciplinas (question_id, subject_atual, subject_origem, enunciado)
-- select id, subject, subject_origem, left(regexp_replace(statement, '\s+', ' ', 'g'), 300)
-- from (
--   select q.id, q.subject, q.subject_origem, q.statement,
--          row_number() over (partition by q.subject order by random()) as rn,
--          count(*) over (partition by q.subject) as n,
--          count(*) over () as total
--   from public.exam_questions q
--   where q.superseded_at is null
--     and q.subject_origem is distinct from 'manual'
--     and not exists (select 1 from public.amostra_disciplinas a where a.question_id = q.id)
-- ) s
-- where rn <= greatest(1, round(200.0 * n / total))
-- on conflict (question_id) do nothing;
-- select count(*) as linhas_na_amostra from public.amostra_disciplinas;   -- esperado: ~200 (a variação é por causa do mínimo de 1 por disciplina)

-- ───────────── PASSO 3 — como revisar ─────────────
-- Veja uma linha por vez, com o enunciado, e preencha a disciplina certa (escolha da lista oficial):
-- select question_id, subject_atual, enunciado from public.amostra_disciplinas
--  where subject_correto is null order by random() limit 10;
-- update public.amostra_disciplinas set subject_correto = 'Direito Penal', revisado_em = now()
--  where question_id = '<uuid>';
-- Se o rótulo atual estiver certo, copie-o: subject_correto = subject_atual.

-- ───────────── PASSO 4 — precisão do rótulo atual ─────────────
select count(*) filter (where subject_correto is not null) as revisadas,
       count(*) filter (where subject_correto = subject_atual) as rotulo_certo,
       round(100.0 * count(*) filter (where subject_correto = subject_atual)
             / nullif(count(*) filter (where subject_correto is not null), 0), 1) as precisao_pct
from public.amostra_disciplinas;

-- Precisão por disciplina atual (mostra onde o rótulo mais erra):
select subject_atual, count(*) as revisadas,
       count(*) filter (where subject_correto = subject_atual) as certas
from public.amostra_disciplinas where subject_correto is not null
group by subject_atual order by revisadas desc, subject_atual;

-- Depois da reclassificação, use a mesma tabela: o rótulo novo é exam_questions.subject.
-- select count(*) filter (where q.subject = a.subject_correto) as acertos_pos,
--        count(*) as revisadas
-- from public.amostra_disciplinas a join public.exam_questions q on q.id = a.question_id
-- where a.subject_correto is not null;
