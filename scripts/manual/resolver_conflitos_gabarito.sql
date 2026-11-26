-- SCRIPT MANUAL — não colocar em supabase/migrations. Requer a v115 (content_hash).
-- Resolve os 8 grupos de questões repetidas cujas cópias têm GABARITOS DIFERENTES.
-- Conclusões feitas pelo Claude, por conhecimento, SEM gabarito oficial: confirme contra a prova antes de aplicar.
--
-- Resumo (grupo = 6 primeiros caracteres do content_hash):
--   255ea4  proposições I/II/III (RLM)            -> D  (II verdadeira torna a condicional verdadeira; nem A nem B servem)
--   43ef0f  "Todos são iguais perante a lei"      -> B  (art. 5º, II; as demais erram anonimato/guerra/horário da casa)
--   ba23c6  (FCM) direitos fundamentais           -> C  (art. 5º, LI, extradição do naturalizado)
--   d3e571  (IOBV) direito fundamental            -> C  (art. 5º, II; a IA tinha marcado D, que está errada)
--   da083e  sociedade açucareira colonial         -> C  (senhores de engenho e escravos africanos)
--   f229d9  Insurreição Pernambucana (EXATUS)     -> D  (I a IV corretas)
--   f5fcef  art. 15 Estatuto do Desarmamento      -> C  (inafiançabilidade declarada inconstitucional na ADI 3112) — menos certa, confira
--   0b28eb  Excel =MÉDIA(A1:B2)                   -> NÃO RESOLVER: a planilha ilustrada (imagem) se perdeu na extração
-- Placar: a cópia "desconhecido" (padrão A) nunca acertou; a sugestão antiga da IA acertou só 3 dos 7 grupos verificáveis.

-- PASSO 1 — PRÉVIA (só leitura). Deve listar 15 linhas, todas 'pendente', em 7 grupos.
with res(grupo, nova) as (values
  ('255ea4', 3), ('43ef0f', 1), ('ba23c6', 2), ('d3e571', 2),
  ('da083e', 2), ('f229d9', 3), ('f5fcef', 2)
)
select left(q.content_hash, 6) as grupo, left(q.id::text, 8) as id, q.gabarito_source as fonte,
       case when q.correct_index is null then null else chr(65 + q.correct_index) end as atual,
       chr(65 + r.nova) as novo, q.status_validacao as status, q.share_with_community as publica,
       left(q.statement, 70) as enunciado
from public.exam_questions q
join res r on left(q.content_hash, 6) = r.grupo
where q.superseded_at is null
order by 1, 2;

-- PASSO 2 — APLICAR (descomente o bloco). A trava exige exatamente 15 linhas; senão, rode: rollback;
-- Só toca em linhas ainda 'pendente' e não revisadas manualmente.
-- begin;
-- with res(grupo, nova) as (values
--   ('255ea4', 3), ('43ef0f', 1), ('ba23c6', 2), ('d3e571', 2),
--   ('da083e', 2), ('f229d9', 3), ('f5fcef', 2)
-- ), upd as (
--   update public.exam_questions q set
--     correct_index = r.nova,
--     gabarito_source = 'manual_revisado',
--     status_validacao = 'verificada',
--     answer_unknown = false
--   from res r
--   where left(q.content_hash, 6) = r.grupo
--     and q.superseded_at is null
--     and q.status_validacao = 'pendente'
--     and q.gabarito_source <> 'manual_revisado'
--   returning q.id
-- )
-- select count(*) as atualizadas from upd;   -- tem que dar 15
-- commit;

-- Depois: rode a prévia de deduplicação. Esses grupos deixam de ser "conflito_gabarito" e passam a ser
-- deduplicáveis (A/B/C), já com a mesma resposta em todas as cópias.

-- OBS (fora do escopo deste script): várias cópias têm disciplina errada (ex.: pergunta de História do
-- Brasil marcada como Direito Constitucional; pergunta constitucional marcada como Língua Portuguesa).
