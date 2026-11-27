-- SCRIPT MANUAL — não colocar em supabase/migrations.
-- Reverte a migração B nas 405 linhas em que a cópia visível pertence a OUTRO dono.
-- Efeito: superseded_at = null e superseded_by = null nessas linhas. Nada é apagado e nenhum gabarito muda.
-- As 330 linhas de B em que a cópia pública é do próprio dono NÃO são tocadas (o dono já as enxerga).
--
-- Antes de aplicar: rode o PASSO 1. Deve dar 405 linhas e 4 donos.
-- Reversão do próprio script: está no fim do arquivo (usa a tabela de backup criada no PASSO 2).

-- ───────────── PASSO 1 — PRÉVIA (só leitura). Esperado: 405 linhas, 4 donos. ─────────────
select count(*) as linhas, count(distinct a.user_id) as donos,
       count(*) filter (where a.validation_error is not null) as com_validacao_registrada
from public.exam_questions a
join public.exam_questions c on c.id = a.superseded_by
where a.superseded_at is not null
  and a.share_with_community = false
  and c.share_with_community = true
  and c.user_id is distinct from a.user_id;

-- ───────────── PASSO 2 — APLICAR (descomente o bloco inteiro). Trava: tem que dar 405. ─────────────
-- begin;
--
-- -- Backup para reversão, com RLS ligado e sem acesso para anon/authenticated.
-- create table if not exists public.bkp_reversao_b_20261126 as
--   select a.id, a.superseded_at, a.superseded_by, now() as copiado_em
--   from public.exam_questions a
--   join public.exam_questions c on c.id = a.superseded_by
--   where a.superseded_at is not null and a.share_with_community = false
--     and c.share_with_community = true and c.user_id is distinct from a.user_id;
-- alter table public.bkp_reversao_b_20261126 enable row level security;
-- revoke all on public.bkp_reversao_b_20261126 from anon, authenticated;
--
-- with alvo as (
--   select a.id from public.exam_questions a
--   join public.exam_questions c on c.id = a.superseded_by
--   where a.superseded_at is not null and a.share_with_community = false
--     and c.share_with_community = true and c.user_id is distinct from a.user_id
-- ), upd as (
--   update public.exam_questions q set superseded_at = null, superseded_by = null
--   from alvo a where q.id = a.id
--   returning q.id
-- )
-- select count(*) as revertidas from upd;   -- tem que dar 405; senão, rode: rollback;
-- commit;

-- ───────────── CONFERÊNCIA depois de aplicar ─────────────
-- select count(*) from public.exam_questions where superseded_at is null;          -- antes era 2772; deve subir em 405
-- select count(*) from public.bkp_reversao_b_20261126;                             -- deve dar 405

-- ───────────── REVERSÃO DESTE SCRIPT (volta ao estado anterior) ─────────────
-- begin;
-- update public.exam_questions q set superseded_at = b.superseded_at, superseded_by = b.superseded_by
--   from public.bkp_reversao_b_20261126 b where q.id = b.id;   -- tem que dar 405
-- commit;
-- Depois de confirmar a reversão, a tabela de backup pode ser removida: drop table public.bkp_reversao_b_20261126;
