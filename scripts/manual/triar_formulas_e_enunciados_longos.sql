-- SCRIPT MANUAL — não colocar em supabase/migrations.
-- Tira da fila de validação automática 22 questões pendentes que não podem ser respondidas com o texto extraído:
--   • 14 com fórmula quebrada (expoentes, raízes e símbolos perdidos na extração; aparecem como caracteres de controle)
--   • 8 com enunciado longo defeituoso: compilações "Julgue o item" sem item a julgar, enunciados que começam
--     no meio de uma frase, lista de atalhos sem pergunta, ou compilações de 39 a 43 mil caracteres que não
--     podem ter uma única resposta.
-- Não é para limpar os caracteres de controle: a fórmula continuaria quebrada.
--
-- O que faz: validation_attempts = 3 e validation_error = 'triagem:...'.
--   • Sai da fila da validate-questions (ela só pega validation_attempts < 3).
--   • Entra na view exam_questions_review_queue (motivo 'triagem_defeituosa') para revisão humana.
--   • Sobrevive a um novo sync: a ingestão não zera validation_attempts.
-- O que NÃO faz: não altera correct_index, gabarito_source, status_validacao nem o enunciado. Não apaga nada.
--
-- Atenção: as 14 fórmulas continuam quebradas na origem (generated_study_content). A correção de fundo é
-- reextrair o PDF ou editar o JSON. Até lá, elas ficam na revisão humana.
-- Para liberar uma questão após revisão, use "Liberar UMA questão" no fim do arquivo.

-- ───────────── PASSO 1 — PRÉVIA (só leitura). Deve listar 22 linhas, todas elegíveis. ─────────────
with alvo(pref, motivo) as (values
  ('0b21194c','triagem:formula_corrompida'), ('205ead51','triagem:formula_corrompida'),
  ('21c5247e','triagem:formula_corrompida'), ('2999b506','triagem:formula_corrompida'),
  ('3c3a3400','triagem:formula_corrompida'), ('3c628812','triagem:formula_corrompida'),
  ('4db876b5','triagem:formula_corrompida'), ('527e6dfb','triagem:formula_corrompida'),
  ('85dc252e','triagem:formula_corrompida'), ('89db9f42','triagem:formula_corrompida'),
  ('939aa838','triagem:formula_corrompida'), ('a1e3e2f8','triagem:formula_corrompida'),
  ('d96b4105','triagem:formula_corrompida'), ('f187192f','triagem:formula_corrompida'),
  ('3f32e8f5','triagem:enunciado_longo_defeituoso'), ('45ffe3ba','triagem:enunciado_longo_defeituoso'),
  ('82b279b8','triagem:enunciado_longo_defeituoso'), ('951faff8','triagem:enunciado_longo_defeituoso'),
  ('381c9109','triagem:enunciado_longo_defeituoso'), ('4adfb6b5','triagem:enunciado_longo_defeituoso'),
  ('92671b1c','triagem:enunciado_longo_defeituoso'), ('c63673e3','triagem:enunciado_longo_defeituoso')
)
select a.motivo, count(*) as n,
       count(*) filter (where q.status_validacao = 'pendente' and q.resposta_ia is null
                          and q.superseded_at is null and q.validation_attempts < 3) as elegiveis
from alvo a
left join public.exam_questions q on left(q.id::text, 8) = a.pref
group by a.motivo
order by a.motivo;
-- Esperado: formula_corrompida = 14 (elegíveis 13 — 0b21194c já foi triada na v113); enunciado_longo_defeituoso = 8 (elegíveis 8). Total elegível = 21.
-- Se algum número for menor, a questão já mudou: não aplique o Passo 2 sem conferir.

-- ───────────── PASSO 2 — APLICAR (descomente o bloco inteiro). Trava: tem que dar 21 (13 fórmulas + 8 enunciados). ─────────────
-- begin;
-- with alvo(pref, motivo) as (values
--   ('0b21194c','triagem:formula_corrompida'), ('205ead51','triagem:formula_corrompida'),
--   ('21c5247e','triagem:formula_corrompida'), ('2999b506','triagem:formula_corrompida'),
--   ('3c3a3400','triagem:formula_corrompida'), ('3c628812','triagem:formula_corrompida'),
--   ('4db876b5','triagem:formula_corrompida'), ('527e6dfb','triagem:formula_corrompida'),
--   ('85dc252e','triagem:formula_corrompida'), ('89db9f42','triagem:formula_corrompida'),
--   ('939aa838','triagem:formula_corrompida'), ('a1e3e2f8','triagem:formula_corrompida'),
--   ('d96b4105','triagem:formula_corrompida'), ('f187192f','triagem:formula_corrompida'),
--   ('3f32e8f5','triagem:enunciado_longo_defeituoso'), ('45ffe3ba','triagem:enunciado_longo_defeituoso'),
--   ('82b279b8','triagem:enunciado_longo_defeituoso'), ('951faff8','triagem:enunciado_longo_defeituoso'),
--   ('381c9109','triagem:enunciado_longo_defeituoso'), ('4adfb6b5','triagem:enunciado_longo_defeituoso'),
--   ('92671b1c','triagem:enunciado_longo_defeituoso'), ('c63673e3','triagem:enunciado_longo_defeituoso')
-- ), upd as (
--   update public.exam_questions q set
--     validation_attempts = 3,
--     validation_error = a.motivo
--   from alvo a
--   where left(q.id::text, 8) = a.pref
--     and q.status_validacao = 'pendente'
--     and q.resposta_ia is null
--     and q.superseded_at is null
--     and q.validation_attempts < 3
--   returning q.id
-- )
-- select count(*) as triadas from upd;   -- tem que dar 21; senão, rode: rollback;
-- commit;

-- ───────────── Conferência depois de aplicar ─────────────
-- select validation_error, count(*) from public.exam_questions
--  where validation_error in ('triagem:formula_corrompida', 'triagem:enunciado_longo_defeituoso') group by 1;
-- select motivo, count(*) from public.exam_questions_review_queue group by 1 order by 1;

-- ───────────── REVERSÃO (desfaz só esta triagem) ─────────────
-- update public.exam_questions set validation_attempts = 0, validation_error = null
--  where validation_error in ('triagem:formula_corrompida', 'triagem:enunciado_longo_defeituoso');

-- ───────────── Liberar UMA questão após revisão humana ─────────────
-- update public.exam_questions set validation_attempts = 0, validation_error = null
--  where left(id::text, 8) = 'COLE_OS_8_CARACTERES';

-- ───────────── Não triados de propósito (conferir depois) ─────────────
-- • 37832fa4 (Direito Militar, 12 mil caracteres): "Julgue o item" com comando no fim; pode ser uma
--   compilação de vários itens com uma única resposta. Revise antes de validar.
-- • Textos-base longos (3 a 4,5 mil caracteres) com a pergunta no fim: são legítimos; a IA confere o comando.
