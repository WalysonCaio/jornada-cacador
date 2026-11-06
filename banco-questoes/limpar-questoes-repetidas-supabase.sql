-- ============================================================================
-- SCRIPT DE LIMPEZA E REMOÇÃO DE QUESTÕES E CONTEÚDOS REPETIDOS NO SUPABASE
-- Como usar: Cole este código no SQL Editor do Supabase e clique em RUN.
-- O que ele faz:
--   1. Remove questões duplicadas em `public.shared_question_bank` mesmo quando
--      foram salvas com prefixos de banca diferentes (ex.: "(AOCP)" vs "(Instituto AOCP)"),
--      mantendo sempre a versão com comentário/explicação mais completa.
--   2. Remove pacotes ou resumos duplicados em `public.generated_study_content`
--      para a mesma campanha e título, mantendo apenas o registro mais recente.
--   3. Desduplica o array interno `content->'questions'` dentro de cada pacote
--      de `public.generated_study_content` para não sobrecarregar o banco.
-- ============================================================================

-- 1. Remove questões repetidas na tabela global `public.shared_question_bank`
--    comparando o enunciado limpo (sem acentos, sem pontuação e sem prefixo de banca)
WITH ranked_questions AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY left(
        regexp_replace(
          lower(
            regexp_replace(statement, '^\s*\([^)]+\)\s*', '')
          ),
          '[^a-z0-9]+', ' ', 'g'
        ),
        120
      )
      ORDER BY length(coalesce(explanation, '')) DESC, created_at DESC
    ) AS rn
  FROM public.shared_question_bank
)
DELETE FROM public.shared_question_bank
WHERE id IN (SELECT id FROM ranked_questions WHERE rn > 1);

-- 2. Remove pacotes/resumos duplicados na mesma campanha em `public.generated_study_content`
WITH ranked_content AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY campaign_id, content_type, lower(trim(title))
      ORDER BY server_verified DESC NULLS LAST, updated_at DESC, created_at DESC
    ) AS rn
  FROM public.generated_study_content
)
DELETE FROM public.generated_study_content
WHERE id IN (SELECT id FROM ranked_content WHERE rn > 1);

-- 3. Desduplica questões repetidas dentro do JSON `content->'questions'` de cada pacote
UPDATE public.generated_study_content g
SET content = jsonb_set(
  g.content,
  '{questions}',
  coalesce(
    (
      SELECT jsonb_agg(dedup.q_obj)
      FROM (
        SELECT DISTINCT ON (
          left(
            regexp_replace(
              lower(coalesce(q_elem->>'statement', '')),
              '[^a-z0-9]+', ' ', 'g'
            ),
            120
          )
        ) q_elem AS q_obj
        FROM jsonb_array_elements(g.content->'questions') AS q_elem
        WHERE coalesce(q_elem->>'statement', '') <> ''
      ) dedup
    ),
    '[]'::jsonb
  )
)
WHERE jsonb_typeof(g.content->'questions') = 'array'
  AND jsonb_array_length(g.content->'questions') > 1;

-- 4. Relatório final pós-limpeza:
SELECT
  (SELECT count(*) FROM public.shared_question_bank) AS questoes_unicas_catalogo_global,
  (SELECT count(*) FROM public.generated_study_content) AS pacotes_conteudo_unicos;
