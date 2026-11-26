-- SCRIPT MANUAL — não colocar em supabase/migrations.
-- Tira da fila de validação automática 52 questões pendentes que NÃO podem ser respondidas
-- com o texto extraído: 7 dependem de imagem (planilha, diagrama, tabela, charge) e 45 dependem de
-- palavra/trecho destacado ou sublinhado, formatação que a extração perdeu.
--
-- O que faz: validation_attempts = 3 e validation_error = 'triagem:...'.
--   • Sai da fila da validate-questions (ela só pega validation_attempts < 3).
--   • Entra na view exam_questions_review_queue (motivo 'triagem_defeituosa') para revisão humana.
-- O que NÃO faz: não altera correct_index, gabarito_source, status_validacao nem o enunciado. Não apaga nada.
--
-- Atenção: são critérios de texto, não de gabarito. Alguns podem ser falsos positivos (a questão
-- responde sem o destaque, porque o termo vem citado no enunciado). Na revisão humana, para liberar uma
-- questão, basta limpar validation_error e zerar validation_attempts (ver REVERSÃO, linha por linha).
-- Não incluídas por dúvida (confira antes de adicionar): 58d9b3c3 e 75de3df6 (quadro negro, o texto pode
-- estar no enunciado), 3f32e8f5 e c63673e3 (listas longas), 8d66c68c (trecho pode estar cortado),
-- aea1cfcc (termo já citado entre aspas), 190f00a4 (falso positivo: "desempenho destacado").

-- ───────────── PASSO 1 — PRÉVIA (só leitura). Deve listar 52 linhas, todas 'pendente'. ─────────────
with alvo(pref, motivo) as (values
  -- imagem
  ('339a4671','triagem:depende_de_imagem'), ('e49f2fed','triagem:depende_de_imagem'),
  ('8bee173e','triagem:depende_de_imagem'), ('4ededbbc','triagem:depende_de_imagem'),
  ('dbee133c','triagem:depende_de_imagem'), ('c838d6e2','triagem:depende_de_imagem'),
  ('fa411b28','triagem:depende_de_imagem'),
  -- destaque / sublinhado / grifo
  ('01769901','triagem:depende_de_destaque'), ('02ddf361','triagem:depende_de_destaque'),
  ('0416f03b','triagem:depende_de_destaque'), ('05a502f6','triagem:depende_de_destaque'),
  ('0b4e5535','triagem:depende_de_destaque'), ('0db2dfb0','triagem:depende_de_destaque'),
  ('145d5343','triagem:depende_de_destaque'), ('193520b1','triagem:depende_de_destaque'),
  ('2bd28467','triagem:depende_de_destaque'), ('3731b682','triagem:depende_de_destaque'),
  ('3974af82','triagem:depende_de_destaque'), ('43cc33db','triagem:depende_de_destaque'),
  ('475a12fb','triagem:depende_de_destaque'), ('4cbeae04','triagem:depende_de_destaque'),
  ('4d8f5cdd','triagem:depende_de_destaque'), ('4e8f44f9','triagem:depende_de_destaque'),
  ('4f66e901','triagem:depende_de_destaque'), ('51d99720','triagem:depende_de_destaque'),
  ('5bebf4ee','triagem:depende_de_destaque'), ('6ba910ed','triagem:depende_de_destaque'),
  ('706d65b0','triagem:depende_de_destaque'), ('71da0d4d','triagem:depende_de_destaque'),
  ('7720d31e','triagem:depende_de_destaque'), ('801b4ee7','triagem:depende_de_destaque'),
  ('86d25c51','triagem:depende_de_destaque'), ('8aef0af3','triagem:depende_de_destaque'),
  ('8cccb638','triagem:depende_de_destaque'), ('901ffb1e','triagem:depende_de_destaque'),
  ('921fc3ea','triagem:depende_de_destaque'), ('9bb24996','triagem:depende_de_destaque'),
  ('9d91817f','triagem:depende_de_destaque'), ('a55a5c61','triagem:depende_de_destaque'),
  ('a7595954','triagem:depende_de_destaque'), ('aa68d1f6','triagem:depende_de_destaque'),
  ('aea1cfcc','triagem:depende_de_destaque'), ('b469fd5e','triagem:depende_de_destaque'),
  ('bae06c23','triagem:depende_de_destaque'), ('bf0ef89c','triagem:depende_de_destaque'),
  ('c5c58313','triagem:depende_de_destaque'), ('d620b92c','triagem:depende_de_destaque'),
  ('dafddd43','triagem:depende_de_destaque'), ('dcbcc9f6','triagem:depende_de_destaque'),
  ('fbb19e53','triagem:depende_de_destaque'), ('fbf9b90d','triagem:depende_de_destaque'),
  ('fc853adc','triagem:depende_de_destaque')
)
select a.motivo, count(*) as n,
       count(*) filter (where q.status_validacao = 'pendente' and q.resposta_ia is null
                          and q.superseded_at is null and q.validation_attempts < 3) as elegiveis
from alvo a
left join public.exam_questions q on left(q.id::text, 8) = a.pref
group by a.motivo
order by a.motivo;
-- Esperado: depende_de_destaque = 45 (elegíveis 45); depende_de_imagem = 7 (elegíveis 7).
-- Se algum número for menor que o esperado, a questão já mudou: não aplique o Passo 2 sem conferir.

-- ───────────── PASSO 2 — APLICAR (descomente o bloco inteiro). Trava: tem que dar 52. ─────────────
-- begin;
-- with alvo(pref, motivo) as (values
--   ('339a4671','triagem:depende_de_imagem'), ('e49f2fed','triagem:depende_de_imagem'),
--   ('8bee173e','triagem:depende_de_imagem'), ('4ededbbc','triagem:depende_de_imagem'),
--   ('dbee133c','triagem:depende_de_imagem'), ('c838d6e2','triagem:depende_de_imagem'),
--   ('fa411b28','triagem:depende_de_imagem'),
--   ('01769901','triagem:depende_de_destaque'), ('02ddf361','triagem:depende_de_destaque'),
--   ('0416f03b','triagem:depende_de_destaque'), ('05a502f6','triagem:depende_de_destaque'),
--   ('0b4e5535','triagem:depende_de_destaque'), ('0db2dfb0','triagem:depende_de_destaque'),
--   ('145d5343','triagem:depende_de_destaque'), ('193520b1','triagem:depende_de_destaque'),
--   ('2bd28467','triagem:depende_de_destaque'), ('3731b682','triagem:depende_de_destaque'),
--   ('3974af82','triagem:depende_de_destaque'), ('43cc33db','triagem:depende_de_destaque'),
--   ('475a12fb','triagem:depende_de_destaque'), ('4cbeae04','triagem:depende_de_destaque'),
--   ('4d8f5cdd','triagem:depende_de_destaque'), ('4e8f44f9','triagem:depende_de_destaque'),
--   ('4f66e901','triagem:depende_de_destaque'), ('51d99720','triagem:depende_de_destaque'),
--   ('5bebf4ee','triagem:depende_de_destaque'), ('6ba910ed','triagem:depende_de_destaque'),
--   ('706d65b0','triagem:depende_de_destaque'), ('71da0d4d','triagem:depende_de_destaque'),
--   ('7720d31e','triagem:depende_de_destaque'), ('801b4ee7','triagem:depende_de_destaque'),
--   ('86d25c51','triagem:depende_de_destaque'), ('8aef0af3','triagem:depende_de_destaque'),
--   ('8cccb638','triagem:depende_de_destaque'), ('901ffb1e','triagem:depende_de_destaque'),
--   ('921fc3ea','triagem:depende_de_destaque'), ('9bb24996','triagem:depende_de_destaque'),
--   ('9d91817f','triagem:depende_de_destaque'), ('a55a5c61','triagem:depende_de_destaque'),
--   ('a7595954','triagem:depende_de_destaque'), ('aa68d1f6','triagem:depende_de_destaque'),
--   ('aea1cfcc','triagem:depende_de_destaque'), ('b469fd5e','triagem:depende_de_destaque'),
--   ('bae06c23','triagem:depende_de_destaque'), ('bf0ef89c','triagem:depende_de_destaque'),
--   ('c5c58313','triagem:depende_de_destaque'), ('d620b92c','triagem:depende_de_destaque'),
--   ('dafddd43','triagem:depende_de_destaque'), ('dcbcc9f6','triagem:depende_de_destaque'),
--   ('fbb19e53','triagem:depende_de_destaque'), ('fbf9b90d','triagem:depende_de_destaque'),
--   ('fc853adc','triagem:depende_de_destaque')
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
-- select count(*) as triadas from upd;   -- tem que dar 52; senão, rode: rollback;
-- commit;

-- ───────────── Conferência depois de aplicar ─────────────
-- select validation_error, count(*) from public.exam_questions
--  where validation_error like 'triagem:depende_de%' group by 1;
-- select motivo, count(*) from public.exam_questions_review_queue group by 1 order by 1;

-- ───────────── REVERSÃO (desfaz esta triagem; não toca nas triagens da v113) ─────────────
-- update public.exam_questions set validation_attempts = 0, validation_error = null
--  where validation_error in ('triagem:depende_de_imagem', 'triagem:depende_de_destaque');

-- ───────────── Liberar UMA questão da triagem (falso positivo confirmado na revisão) ─────────────
-- update public.exam_questions set validation_attempts = 0, validation_error = null
--  where left(id::text, 8) = 'COLE_OS_8_CARACTERES';

-- ───────────── Pendências fora desta triagem ─────────────
-- • 28 enunciados com mais de 3.000 caracteres (compilações "Julgue o item" de Informática e Legislação).
--   Não triados aqui: o prompt-v2 já devolve null quando falta comando ou itens, mas vale conferir os
--   de Informática, que parecem glossários sem item a julgar.
-- • 14 enunciados com caracteres de controle invisíveis: limpeza à parte (não muda o sentido).
-- • 2 questões já marcadas como divergentes (610e605f e 9ab03de8) dependem de destaque: já estão na fila
--   humana, nada a fazer por este script.
