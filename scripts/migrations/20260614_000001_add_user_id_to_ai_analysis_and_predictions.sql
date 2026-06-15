-- Migration: Add user_id column to ai_analysis and predictions for multi-tenant isolation
-- Timestamp: 20260614_000001
-- Description:
-- - Adds ai_analysis.user_id (UUID NOT NULL)
-- - Adds predictions.user_id (UUID NOT NULL)
-- - Backfills existing rows with SYSTEM_USER_ID placeholder UUID
-- - Adds FK constraints to users(id)
-- - Adds indexes for common tenant-scoped lookups

BEGIN;

-- =========================
-- ai_analysis.user_id
-- =========================
ALTER TABLE ai_analysis
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE ai_analysis
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

ALTER TABLE ai_analysis
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_analysis_user_id_fkey'
  ) THEN
    ALTER TABLE ai_analysis
      ADD CONSTRAINT ai_analysis_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_analysis_user_symbol_idx
  ON ai_analysis(user_id, symbol);
CREATE INDEX IF NOT EXISTS ai_analysis_user_created_at_idx
  ON ai_analysis(user_id, created_at);

-- =========================
-- predictions.user_id
-- =========================
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE predictions
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

ALTER TABLE predictions
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'predictions_user_id_fkey'
  ) THEN
    ALTER TABLE predictions
      ADD CONSTRAINT predictions_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS predictions_user_symbol_idx
  ON predictions(user_id, symbol);
CREATE INDEX IF NOT EXISTS predictions_user_created_at_idx
  ON predictions(user_id, created_at);

COMMIT;
