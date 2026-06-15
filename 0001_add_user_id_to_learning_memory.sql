-- Migration to add user_id column to learning_memory table.
-- Migration to add user_id column to relevant tables.
-- This aligns the physical database schema with the Drizzle ORM definition.

ALTER TABLE "learning_memory" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE INDEX IF NOT EXISTS "learning_memory_user_id_idx" ON "learning_memory" ("user_id");

ALTER TABLE "ai_analysis" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE INDEX IF NOT EXISTS "ai_analysis_user_id_idx" ON "ai_analysis" ("user_id");

ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE INDEX IF NOT EXISTS "predictions_user_id_idx" ON "predictions" ("user_id");