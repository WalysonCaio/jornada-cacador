-- v113: triagem SEM IA. Tira da fila de validação as questões com extração defeituosa.
-- Não apaga nada e não mexe em correct_index. Reversível (ver o fim do arquivo).
-- validation_attempts = 3 faz a questão sair da fila (a fila usa validation_attempts < 3).

-- 1) Alternativa contaminada por texto-base colado dentro das opções
update public.exam_questions set
  validation_attempts = 3,
  validation_error = 'triagem:alternativa_contaminada'
where status_validacao = 'pendente'
  and resposta_ia is null
  and validation_attempts < 3
  and exists (
    select 1 from jsonb_array_elements_text(options) o
    where length(o) > 300 or o ilike '%servirá de base%' or o ilike '%texto seguinte%'
  );

-- 2) Enunciado curtíssimo e sem pergunta (provável corte na extração)
update public.exam_questions set
  validation_attempts = 3,
  validation_error = 'triagem:enunciado_curto'
where status_validacao = 'pendente'
  and resposta_ia is null
  and validation_attempts < 3
  and length(statement) < 40
  and statement !~ '\?';
