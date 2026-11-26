-- SCRIPT MANUAL — não colocar em supabase/migrations. Rode só depois de conferir.
-- REMOVIDA: 9ab03de8 (depende de palavra destacada, perdida na extração). Lista agora tem 17.
-- Corrige correct_index em 17 questões onde a IA divergiu e a revisão (feita pelo Claude, por
-- conhecimento, SEM gabarito oficial) concluiu que a IA acertou e o cadastrado estava errado.
-- Confira contra o gabarito oficial antes de aplicar, em especial estas menos certas:
--   284f72cf (direito à alimentação: 2ª dimensão)   63332c2d (FCC 2017, colonização)
--   56706749 (regra de três composta, UPE)          2e33d7a6 (.gov.br)
-- A trava "join + resposta_ia = nova" só atualiza se a IA ainda tiver gravado exatamente essa letra.
-- Fundamentos citados pelo Groq nesses casos tinham erros (ex.: 00145561, 2212372e, 300ba421, 7055c2a7);
-- o que se corrige aqui é a LETRA, não o texto do fundamento.

-- PASSO 1 — PRÉVIA (só leitura). Deve listar 17 linhas.
with corr(pref, nova) as (values
  ('00145561', 2), ('2212372e', 4), ('284f72cf', 1), ('2e33d7a6', 2), ('300ba421', 2),
  ('4955dc6b', 3), ('4c72a24c', 1), ('4f7aab78', 1), ('56706749', 1), ('63332c2d', 3),
  ('7055c2a7', 1), ('84f1a7d1', 4), ('90565837', 1), ('ae55b8a0', 1),
  ('d7963f0a', 1), ('ddde9a39', 2), ('f9d73ba6', 0)
  -- Opcionais (também conferidos como IA correta; descomente a vírgula e as linhas se quiser incluir
  -- e ajuste a trava de 17 para 19):
  -- , ('8323080d', 4), ('b221556c', 3)
)
select left(q.id::text, 8) as id, q.correct_index as atual, c.nova as novo, q.resposta_ia,
       q.ia_model, left(q.statement, 60) as enunciado
from public.exam_questions q
join corr c on q.id::text like c.pref || '%'
where q.status_validacao = 'divergente' and q.resposta_ia = c.nova
order by 1;

-- PASSO 2 — APLICAR (descomente o bloco inteiro). Se a contagem não der 17, rode: rollback;
-- begin;
-- with corr(pref, nova) as (values
--   ('00145561', 2), ('2212372e', 4), ('284f72cf', 1), ('2e33d7a6', 2), ('300ba421', 2),
--   ('4955dc6b', 3), ('4c72a24c', 1), ('4f7aab78', 1), ('56706749', 1), ('63332c2d', 3),
--   ('7055c2a7', 1), ('84f1a7d1', 4), ('90565837', 1), ('ae55b8a0', 1),
--   ('d7963f0a', 1), ('ddde9a39', 2), ('f9d73ba6', 0)
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
-- select count(*) as atualizadas from upd;   -- tem que dar 17
-- commit;

-- OBS: depois de aplicar a v115, estas linhas ficam protegidas contra sync e contra edição pelo app.
