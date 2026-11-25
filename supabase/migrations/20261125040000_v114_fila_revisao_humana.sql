-- v114: fila de revisão humana de public.exam_questions (somente leitura; não altera dados).
-- security_invoker = true: a view respeita o RLS de quem consulta (nada vaza entre usuários).

create or replace view public.exam_questions_review_queue
with (security_invoker = true) as
select
  q.id,
  case
    when q.status_validacao = 'divergente'                                   then 'divergente_ia'
    when q.correct_index is null and q.resposta_ia is not null                then 'sem_gabarito_com_ia'
    when q.validation_error like 'passes_divergentes%'                        then 'passes_divergentes'
    when q.validation_error = 'ambigua'                                       then 'ambigua'
    when q.validation_error in ('itens_ou_texto_base_ausentes','sem_comando')
      or q.validation_error like 'passe2:%'                                   then 'incompleta_segundo_ia'
    when q.validation_error like 'triagem:%'                                  then 'triagem_defeituosa'
  end as motivo,
  case
    when q.status_validacao = 'divergente'                                    then 1
    when q.correct_index is null and q.resposta_ia is not null                then 2
    when q.validation_error like 'passes_divergentes%'                        then 3
    when q.validation_error = 'ambigua'                                       then 4
    when q.validation_error in ('itens_ou_texto_base_ausentes','sem_comando')
      or q.validation_error like 'passe2:%'                                   then 5
    when q.validation_error like 'triagem:%'                                  then 6
  end as prioridade,
  q.ia_confianca as confianca,
  q.ia_model as modelo,
  (q.ia_model like 'groq:%') as modelo_fallback,       -- fundamentos do fallback exigem checagem extra
  q.board, q.subject,
  left(q.statement, 160) as enunciado,
  case when q.correct_index is null then null else chr(65 + q.correct_index) end as cadastrado,
  case when q.resposta_ia  is null then null else chr(65 + q.resposta_ia)  end as ia,
  q.gabarito_source,
  q.fundamento_ia,
  q.validation_error,
  q.validated_at
from public.exam_questions q
where q.status_validacao = 'divergente'
   or (q.correct_index is null and q.resposta_ia is not null)
   or q.validation_error like 'passes_divergentes%'
   or q.validation_error = 'ambigua'
   or q.validation_error in ('itens_ou_texto_base_ausentes','sem_comando')
   or q.validation_error like 'passe2:%'
   or q.validation_error like 'triagem:%';

revoke all on public.exam_questions_review_queue from anon;

-- Uso (ordem de trabalho: prioridade, depois confiança alta -> baixa, depois mais recentes):
-- select * from public.exam_questions_review_queue
--  order by prioridade,
--           case confianca when 'alta' then 1 when 'media' then 2 when 'baixa' then 3 else 4 end,
--           validated_at desc nulls last;
--
-- Resumo por motivo:
-- select motivo, count(*) from public.exam_questions_review_queue group by 1 order by min(prioridade);
