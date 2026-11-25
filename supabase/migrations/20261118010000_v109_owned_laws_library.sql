-- v109: cada conta pode manter a própria cópia da mesma seleção legal.
-- Requer a tabela criada por 20261117130000_v106_internal_laws_bank.sql.
-- Preserva dados existentes, inclusive registros legados sem proprietário,
-- e mantém a política de compartilhamento da biblioteca.
BEGIN;

ALTER TABLE public.study_laws_bank
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_version text NOT NULL DEFAULT 'legacy-unversioned',
  ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'selection',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  existing_pk text;
BEGIN
  SELECT c.conname INTO existing_pk
  FROM pg_constraint c
  WHERE c.conrelid = 'public.study_laws_bank'::regclass
    AND c.contype = 'p'
    AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.study_laws_bank'::regclass AND attname = 'id')]::smallint[];
  IF existing_pk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.study_laws_bank DROP CONSTRAINT %I', existing_pk);
  END IF;
END;
$$;

-- UNIQUE é suficiente para o on_conflict=user_id,id e não força atribuição
-- de registros legados com user_id nulo a uma conta arbitrária.
CREATE UNIQUE INDEX IF NOT EXISTS study_laws_bank_user_id_id_key
  ON public.study_laws_bank (user_id, id);

ALTER TABLE public.study_laws_bank ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_laws_bank TO authenticated;

COMMENT ON TABLE public.study_laws_bank IS
  'Seleções e trechos para estudo por conta; fonte/versão registradas, sem garantia de integralidade ou revisão factual.';

COMMIT;
