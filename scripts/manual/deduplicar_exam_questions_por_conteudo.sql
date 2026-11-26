-- SCRIPT MANUAL — não colocar em supabase/migrations. Requer a v115 aplicada (content_hash, superseded_*).
-- Marca cópias repetidas (mesmo content_hash) como SUBSTITUÍDAS (superseded_at / superseded_by).
-- NADA É APAGADO e nenhum gabarito é alterado. O front e a validate-questions já filtram superseded_at is null.
--
-- Regras de segurança:
--  • A cópia canônica é a melhor do grupo: validada/revisada > com resposta da IA > gabarito colado/oficial >
--    pública > ligada a um PDF > mais antiga. Uma cópia validada NUNCA é substituída.
--  • Grupos com GABARITOS CONFLITANTES não são tocados (revisão humana).
--  • Privacidade: pública nunca é escondida por privada; uma privada só é substituída por cópia que o dono
--    consiga ver (pública ou do mesmo dono). Privadas de donos diferentes ficam como estão.
--  • Categorias B e D ficam FORA da aplicação padrão (ver explicação na prévia).

-- ───────────── PASSO 0 — view do plano (não altera dados; só para administrador) ─────────────
create or replace view public.exam_questions_dedup_plan
with (security_invoker = true) as
with base as (
  select q.id, q.content_hash, q.user_id, q.campaign_id, q.share_with_community as pub,
         q.correct_index, q.document_id, q.created_at, q.gabarito_source,
         (q.status_validacao <> 'pendente' or q.gabarito_source in ('manual_revisado','oficial_pdf')) as validada,
         (q.resposta_ia is not null) as tem_ia
  from public.exam_questions q
  where q.superseded_at is null and q.content_hash is not null
),
grp as (
  select content_hash,
         count(distinct correct_index) filter (where correct_index is not null) as respostas_distintas
  from base group by content_hash having count(*) > 1
),
rk as (
  select b.*, g.respostas_distintas,
         row_number() over (
           partition by b.content_hash
           order by b.validada desc, b.tem_ia desc,
                    (b.gabarito_source in ('manual_revisado','oficial_pdf','colado')) desc,
                    b.pub desc, (b.document_id is not null) desc, b.created_at, b.id) as rn
  from base b join grp g using (content_hash)
)
select r.id,
       c.id as canonica_id,
       r.content_hash,
       r.validada,
       case
         when r.respostas_distintas > 1                                       then 'conflito_gabarito'
         when r.pub and not c.pub                                             then 'bloqueada_publica_sob_privada'
         when not (c.pub or r.user_id is not distinct from c.user_id)         then 'bloqueada_outro_dono'
         when r.pub and c.pub                                                 then 'A_publica_por_publica'
         when c.pub and not r.pub                                             then 'B_privada_por_publica'
         when r.campaign_id is not distinct from c.campaign_id                then 'C_mesmo_dono_mesma_campanha'
         else                                                                      'D_mesmo_dono_outra_campanha'
       end as categoria
from rk r
join rk c on c.content_hash = r.content_hash and c.rn = 1
where r.rn > 1;

revoke all on public.exam_questions_dedup_plan from anon, authenticated;

-- ───────────── PASSO 1 — PRÉVIA (só leitura) ─────────────
-- Estado em 25/11/2026: A=129, B=735, C=162, D=3, bloqueada_outro_dono=54, conflito_gabarito=9 (1.092 no total).
select categoria, count(*) as n, count(*) filter (where validada) as validadas
from public.exam_questions_dedup_plan group by 1 order by 1;

-- Conflitos de gabarito para revisão humana (mesmo conteúdo, letras diferentes):
-- select left(p.content_hash, 8) as grupo, left(q.id::text, 8) as id, q.gabarito_source,
--        case when q.correct_index is null then null else chr(65 + q.correct_index) end as letra,
--        q.status_validacao, q.share_with_community as publica, left(q.statement, 70) as enunciado
-- from public.exam_questions q
-- where q.superseded_at is null
--   and q.content_hash in (select content_hash from public.exam_questions_dedup_plan where categoria = 'conflito_gabarito')
-- order by q.content_hash, q.gabarito_source, q.id;

-- ───────────── PASSO 2 — APLICAR categorias seguras A e C (descomente o bloco) ─────────────
-- Esperado: 291 (129 + 162). Se a contagem não bater com a prévia, rode: rollback;
-- begin;
-- with alvo as (
--   select id, canonica_id from public.exam_questions_dedup_plan
--   where categoria in ('A_publica_por_publica', 'C_mesmo_dono_mesma_campanha') and not validada
-- ), upd as (
--   update public.exam_questions q
--   set superseded_at = now(), superseded_by = a.canonica_id
--   from alvo a
--   where q.id = a.id and q.superseded_at is null
--   returning q.id
-- )
-- select count(*) as substituidas from upd;
-- commit;

-- ───────────── PASSO 3 (OPCIONAL, não recomendado ainda) — categoria B ─────────────
-- B = cópia PRIVADA de alguém cujo conteúdo já existe PÚBLICO (ex.: o "Banco Oficial Compartilhado").
-- Só aplique depois de confirmar que o front não filtra por campaign_id ao listar questões do portal; senão o
-- portal do usuário deixaria de mostrar a questão (a pública pertence a outra campanha).
-- D = mesmo dono em outra campanha: mesma ressalva. Deixe de fora.
-- (mesmo bloco do Passo 2, trocando a lista por 'B_privada_por_publica' e, se quiser, 'D_mesmo_dono_outra_campanha')

-- ───────────── REVERSÃO ─────────────
-- Desfaz TUDO o que foi substituído por deduplicação (superseded_by preenchido):
-- update public.exam_questions set superseded_at = null, superseded_by = null where superseded_by is not null;
-- Só desta rodada (troque o horário): ... where superseded_by is not null and superseded_at >= '2026-11-25 20:00:00+00';
