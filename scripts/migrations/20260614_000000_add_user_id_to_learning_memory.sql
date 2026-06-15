-- Migration: Add user_id column to learning_memory for multi-tenant isolation
-- Timestamp: 20260614_000000
-- Description:
-- - Adds learning_memory.user_id (UUID NOT NULL)
-- - Backfills existing rows with SYSTEM_USER_ID placeholder UUID
-- - Adds FK constraint to users(id)

BEGIN;

-- 1) Add column as nullable first (so we can backfill existing rows)
ALTER TABLE learning_memory
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2) Backfill existing rows
UPDATE learning_memory
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

-- 3) Enforce NOT NULL
ALTER TABLE learning_memory
  ALTER COLUMN user_id SET NOT NULL;

-- 4) Add FK constraint (idempotent style)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learning_memory_user_id_fkey'
  ) THEN
    ALTER TABLE learning_memory
      ADD CONSTRAINT learning_memory_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Optional: indexes for common tenant-scoped lookups
CREATE INDEX IF NOT EXISTS lm_user_symbol_idx ON learning_memory(user_id, symbol);
CREATE INDEX IF NOT EXISTS lm_user_created_at_idx ON learning_memory(user_id, created_at);

COMMIT;
