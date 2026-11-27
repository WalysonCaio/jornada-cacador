-- SCRIPT MANUAL — não colocar em supabase/migrations.
-- Troca 8 rótulos de disciplina que são TRECHOS DE ENUNCIADO copiados na extração
-- (começam com "Ano: ... Banca: ... Prova: ..."), por 'Conteúdo Geral'.
-- NÃO mexe em: rótulos longos mas legítimos (ex.: "Direito Militar - Promoções, agregação, remuneração e disciplina"),
-- nem em tópicos (os tópicos longos são legítimos), nem em correct_index, gabarito ou status.
-- Não apaga nada. Reversível pelo backup.

-- ───────────── PASSO 1 — PRÉVIA (só leitura). Esperado: 8 linhas. ─────────────
select left(id::text, 8) as id, status_validacao as status, subject as rotulo_atual, length(statement) as len_enunciado
from public.exam_questions
where superseded_at is null
  and subject ~* '^\s*(ano:|banca:|prova:|[oó]rg[aã]o:)'
order by id;

-- ───────────── PASSO 2 — APLICAR (descomente o bloco inteiro). Trava: tem que dar 8. ─────────────
-- begin;
-- create table if not exists public.bkp_rotulos_lixo_20261126 as
--   select id, subject as subject_anterior, now() as copiado_em
--   from public.exam_questions
--   where superseded_at is null and subject ~* '^\s*(ano:|banca:|prova:|[oó]rg[aã]o:)';
-- alter table public.bkp_rotulos_lixo_20261126 enable row level security;
-- revoke all on public.bkp_rotulos_lixo_20261126 from anon, authenticated;
--
-- with upd as (
--   update public.exam_questions set subject = 'Conteúdo Geral'
--   where superseded_at is null and subject ~* '^\s*(ano:|banca:|prova:|[oó]rg[aã]o:)'
--   returning id
-- )
-- select count(*) as atualizadas from upd;   -- tem que dar 8; senão, rode: rollback;
-- commit;

-- ───────────── CONFERÊNCIA ─────────────
-- select count(*) from public.exam_questions where superseded_at is null and subject ~* '^\s*(ano:|banca:|prova:|[oó]rg[aã]o:)';  -- deve dar 0
-- select count(*) from public.bkp_rotulos_lixo_20261126;                                                                          -- deve dar 8

-- ───────────── REVERSÃO ─────────────
-- begin;
-- update public.exam_questions q set subject = b.subject_anterior
--   from public.bkp_rotulos_lixo_20261126 b where q.id = b.id;   -- tem que dar 8
-- commit;
