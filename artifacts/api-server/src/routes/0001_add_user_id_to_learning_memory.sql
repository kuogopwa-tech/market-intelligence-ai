-- Migration to add user_id column to learning_memory table.
-- This aligns the physical database schema with the Drizzle ORM definition.

ALTER TABLE "learning_memory" ADD COLUMN "user_id" TEXT;
CREATE INDEX IF NOT EXISTS "learning_memory_user_id_idx" ON "learning_memory" ("user_id");