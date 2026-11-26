-- v117: fila de revisão humana final de public.exam_questions.
-- Somente leitura: não altera dados. Substitui o uso da v114 (que deixava de fora as mensagens de texto livre).
-- security_invoker = true: respeita o RLS de quem consulta.
--
-- Motivos, em ordem de prioridade:
--   1 divergente_ia               IA discorda do cadastrado
--   2 sem_gabarito_com_ia         sem gabarito cadastrado, mas a IA sugeriu uma letra
--   3 passes_divergentes          IA respondeu diferente com a ordem das alternativas invertida
--   4 ambigua                     mais de uma alternativa parece correta
--   5 incompleta_segundo_ia       faltam comando, itens ou texto-base no enunciado
--   6 ia_nao_respondeu            a IA deu uma resposta de texto livre (ver validation_error)
--   7 erro_tecnico                falha de chamada à API (reprocessar, não revisar o conteúdo)
--   8 triagem_imagem              depende de figura, tabela, planilha ou quadro
--   9 triagem_destaque            depende de palavra destacada que a extração perdeu
--  10 triagem_formula             fórmula quebrada na extração
--  11 triagem_enunciado_longo     compilação ou corte defeituoso
--  12 triagem_alternativa_contaminada  texto-base colado dentro das alternativas
--  13 triagem_enunciado_curto     enunciado curto demais, provável corte

create or replace view public.exam_questions_review_final
with (security_invoker = true) as
with base as (
  select q.*,
    case
      when q.status_validacao = 'divergente'                                         then 'divergente_ia'
      when q.correct_index is null and q.resposta_ia is not null                     then 'sem_gabarito_com_ia'
      when q.validation_error like 'passes_divergentes%'                             then 'passes_divergentes'
      when q.validation_error in ('ambigua', 'passe2:ambigua')                       then 'ambigua'
      when q.validation_error in ('itens_ou_texto_base_ausentes', 'sem_comando',
                                  'passe2:sem_comando', 'passe2:itens_ou_texto_base_ausentes')
                                                                                      then 'incompleta_segundo_ia'
      when q.validation_error ~* '(gemini|groq|deepseek|429|500|503|timeout|fetch|rate|network)'
           and q.resposta_ia is null                                                  then 'erro_tecnico'
      when q.validation_error is not null and q.resposta_ia is null                  then 'ia_nao_respondeu'
      when q.validation_error = 'triagem:depende_de_imagem'                          then 'triagem_imagem'
      when q.validation_error = 'triagem:depende_de_destaque'                        then 'triagem_destaque'
      when q.validation_error = 'triagem:formula_corrompida'                         then 'triagem_formula'
      when q.validation_error = 'triagem:enunciado_longo_defeituoso'                 then 'triagem_enunciado_longo'
      when q.validation_error = 'triagem:alternativa_contaminada'                    then 'triagem_alternativa_contaminada'
      when q.validation_error = 'triagem:enunciado_curto'                            then 'triagem_enunciado_curto'
    end as motivo
  from public.exam_questions q
  where q.superseded_at is null
)
select
  b.id,
  b.motivo,
  case b.motivo
    when 'divergente_ia' then 1 when 'sem_gabarito_com_ia' then 2 when 'passes_divergentes' then 3
    when 'ambigua' then 4 when 'incompleta_segundo_ia' then 5 when 'ia_nao_respondeu' then 6
    when 'erro_tecnico' then 7 when 'triagem_imagem' then 8 when 'triagem_destaque' then 9
    when 'triagem_formula' then 10 when 'triagem_enunciado_longo' then 11
    when 'triagem_alternativa_contaminada' then 12 when 'triagem_enunciado_curto' then 13
  end as prioridade,
  case b.motivo
    when 'divergente_ia' then 'Conferir o gabarito oficial da prova. Se bater com a IA, corrigir pelo script de correções; se não, manter o cadastrado e marcar manual.'
    when 'sem_gabarito_com_ia' then 'Definir o gabarito pelo PDF da prova. A IA sugeriu a letra indicada na coluna ia.'
    when 'passes_divergentes' then 'A IA respondeu de forma diferente com a ordem invertida. Resolver manualmente.'
    when 'ambigua' then 'Mais de uma alternativa parece correta. Revisar o enunciado e o gabarito.'
    when 'incompleta_segundo_ia' then 'Enunciado sem comando ou sem itens/texto-base. Reextrair do PDF.'
    when 'ia_nao_respondeu' then 'A IA não conseguiu responder. Ler o validation_error e decidir: reextrair ou resolver manualmente.'
    when 'erro_tecnico' then 'Falha técnica na chamada à IA. Reprocessar o lote; o conteúdo não precisa de revisão.'
    when 'triagem_imagem' then 'Depende de figura, tabela, planilha ou quadro. Reextrair com a imagem ou excluir.'
    when 'triagem_destaque' then 'Depende de palavra destacada que se perdeu. Confirmar no PDF; se o enunciado já citar o termo, liberar.'
    when 'triagem_formula' then 'Fórmula quebrada na extração. Corrigir a partir do PDF.'
    when 'triagem_enunciado_longo' then 'Compilação ou corte defeituoso. Dividir em questões ou reextrair.'
    when 'triagem_alternativa_contaminada' then 'Texto-base colado dentro das alternativas. Limpar ou reextrair.'
    when 'triagem_enunciado_curto' then 'Enunciado curto demais, provável corte. Reextrair.'
  end as acao_sugerida,
  b.ia_confianca as confianca,
  b.ia_model as modelo,
  (b.ia_model like 'groq:%') as modelo_fallback,
  b.board, b.subject, b.topic, b.exam_year, b.exam_title, b.question_number,
  b.statement,
  b.options,
  case when b.correct_index is null then null else chr(65 + b.correct_index) end as cadastrado,
  case when b.resposta_ia  is null then null else chr(65 + b.resposta_ia)  end as ia,
  b.gabarito_source,
  b.fundamento_ia,
  b.validation_error,
  b.validation_attempts,
  b.validated_at,
  b.id as id_completo
from base b
where b.motivo is not null;

revoke all on public.exam_questions_review_final from anon;

-- Uso (ordem de trabalho: prioridade, depois confiança alta -> baixa, depois mais recentes):
-- select prioridade, motivo, count(*) from public.exam_questions_review_final group by 1, 2 order by 1;
--
-- select * from public.exam_questions_review_final
--  order by prioridade,
--           case confianca when 'alta' then 1 when 'media' then 2 when 'baixa' then 3 else 4 end,
--           validated_at desc nulls last;
--
-- Conferência: nenhuma pendência pode ficar sem motivo (deve dar 0):
-- select count(*) from public.exam_questions q
--  where q.superseded_at is null
--    and (q.status_validacao = 'divergente' or q.validation_error is not null
--         or (q.correct_index is null and q.resposta_ia is not null))
--    and q.id not in (select id from public.exam_questions_review_final);
