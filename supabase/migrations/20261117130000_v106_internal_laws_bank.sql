-- Migration v106: Internal Laws & Foundational Texts Database (study_laws_bank)
-- Allows storing all complete laws, articles, and foundational study texts directly in the user's Supabase database.

CREATE TABLE IF NOT EXISTS public.study_laws_bank (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline text NOT NULL,
  title text NOT NULL,
  badge text DEFAULT 'Base Interna do Banco',
  source_name text DEFAULT 'Banco Interno Jornada do Caçador',
  articles jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_laws_bank_discipline ON public.study_laws_bank(discipline);

ALTER TABLE public.study_laws_bank ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_laws_bank' AND policyname = 'study_laws_bank_select_all'
  ) THEN
    CREATE POLICY study_laws_bank_select_all ON public.study_laws_bank
      FOR SELECT USING (is_public = true OR auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_laws_bank' AND policyname = 'study_laws_bank_upsert_own'
  ) THEN
    CREATE POLICY study_laws_bank_upsert_own ON public.study_laws_bank
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
