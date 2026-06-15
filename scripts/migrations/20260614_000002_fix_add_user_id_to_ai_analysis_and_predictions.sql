-- Migration: Fix user_id addition to ai_analysis and predictions (idempotent)
-- Adds:
--  - ai_analysis.user_id UUID NOT NULL + FK to users(id)
--  - predictions.user_id UUID NOT NULL + FK to users(id)
-- Backfills existing rows with SYSTEM_USER_ID placeholder UUID
-- Adds indexes

BEGIN;

-- =========================
-- ai_analysis.user_id
-- =========================
ALTER TABLE public.ai_analysis
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill only rows where NULL (covers cases where column existed but was nullable)
UPDATE public.ai_analysis
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

ALTER TABLE public.ai_analysis
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_analysis_user_id_fkey'
  ) THEN
    ALTER TABLE public.ai_analysis
      ADD CONSTRAINT ai_analysis_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_analysis_user_symbol_idx
  ON public.ai_analysis(user_id, symbol);
CREATE INDEX IF NOT EXISTS ai_analysis_user_created_at_idx
  ON public.ai_analysis(user_id, created_at);

-- =========================
-- predictions.user_id
-- =========================
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.predictions
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

ALTER TABLE public.predictions
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'predictions_user_id_fkey'
  ) THEN
    ALTER TABLE public.predictions
      ADD CONSTRAINT predictions_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS predictions_user_symbol_idx
  ON public.predictions(user_id, symbol);
CREATE INDEX IF NOT EXISTS predictions_user_created_at_idx
  ON public.predictions(user_id, created_at);

COMMIT;
