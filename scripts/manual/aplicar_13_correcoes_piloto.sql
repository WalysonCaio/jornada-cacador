-- SCRIPT MANUAL — não colocar em supabase/migrations. Rode só depois de conferir.
-- Corrige correct_index em 13 questões do piloto onde a IA divergiu e a revisão
-- (feita pelo Claude, por conhecimento, SEM gabarito oficial) concluiu que a IA acertou.
-- Confira as duas menos certas contra o gabarito oficial antes de aplicar:
--   9d60b7ef (quilombos, CESGRANRIO 2010)  e  d12bef31 (UPE/Pintor: C vs E).

-- PASSO 1 — PRÉVIA (só leitura). Deve listar 13 linhas.
with corr(pref, nova) as (values
  ('07a5149e', 3), ('42eb607b', 1), ('484caffa', 0), ('4a2c8d9c', 3), ('4bac9b7a', 1),
  ('4ec0c612', 2), ('67ac4af8', 3), ('84c52d79', 3), ('9d60b7ef', 3), ('a74a3069', 2),
  ('bc42aa1d', 4), ('d12bef31', 2), ('e7a4be9e', 2)
)
select left(q.id::text, 8) as id, q.correct_index as atual, c.nova as novo, q.resposta_ia,
       left(q.statement, 60) as enunciado
from public.exam_questions q
join corr c on q.id::text like c.pref || '%'
where q.status_validacao = 'divergente' and q.resposta_ia = c.nova
order by 1;

-- PASSO 2 — APLICAR (descomente o bloco inteiro). A trava "= 13" desfaz tudo se algo não bater.
-- begin;
-- with corr(pref, nova) as (values
--   ('07a5149e', 3), ('42eb607b', 1), ('484caffa', 0), ('4a2c8d9c', 3), ('4bac9b7a', 1),
--   ('4ec0c612', 2), ('67ac4af8', 3), ('84c52d79', 3), ('9d60b7ef', 3), ('a74a3069', 2),
--   ('bc42aa1d', 4), ('d12bef31', 2), ('e7a4be9e', 2)
-- ), alvo as (
--   select q.id, c.nova from public.exam_questions q
--   join corr c on q.id::text like c.pref || '%'
--   where q.status_validacao = 'divergente' and q.resposta_ia = c.nova
-- ), upd as (
--   update public.exam_questions q set
--     correct_index = a.nova,
--     gabarito_source = 'manual_revisado',
--     status_validacao = 'verificada',
--     answer_unknown = false
--   from alvo a where q.id = a.id
--   returning q.id
-- )
-- select count(*) as atualizadas from upd;   -- tem que dar 13; senão, rode: rollback;
-- commit;
