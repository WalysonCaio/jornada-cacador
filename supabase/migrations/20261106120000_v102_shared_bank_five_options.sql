-- v102: ALINHA O BANCO COMPARTILHADO COM QUESTÕES DE 5 ALTERNATIVAS
-- A v79 foi editada no repositório para aceitar correct_index de 0 a 4, mas editar uma migração já executada
-- não muda um banco existente: ali a restrição continua "correct_index <= 3" e uma questão A–E com gabarito E
-- seria recusada. Esta migração ajusta a restrição de quem já executou a v79 (idempotente; não faz nada se a
-- tabela não existir).

do $$
begin
  if to_regclass('public.shared_question_bank') is not null then
    alter table public.shared_question_bank drop constraint if exists shared_question_bank_correct_index_check;
    alter table public.shared_question_bank
      add constraint shared_question_bank_correct_index_check
      check (correct_index >= 0 and correct_index <= 4);
  end if;
end
$$;

-- Conferência (rode manualmente):
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.shared_question_bank'::regclass and conname = 'shared_question_bank_correct_index_check';
--   -> deve mostrar: CHECK (((correct_index >= 0) AND (correct_index <= 4)))
