-- Migration: Add partial unique index to enforce single active prediction per (user_id, symbol)
-- Timestamp: 20260616_000003
-- Description:
--   Creates a concurrency lock using PostgreSQL only.
--   Active prediction = rows where outcome IS NULL.
--
-- Idempotent by using CREATE INDEX IF NOT EXISTS.

CREATE UNIQUE INDEX IF NOT EXISTS predictions_active_unique_idx
ON public.predictions (user_id, symbol)
WHERE outcome IS NULL;
