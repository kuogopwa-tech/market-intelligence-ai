-- Adds prediction resolveAt and status for production prediction timing
-- This project uses Drizzle migrations; run via existing migration scripts.

ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS resolve_at bigint,
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('pending','correct','incorrect'));

-- Default existing rows (best-effort):
-- If outcome already resolved, mark correct/incorrect; otherwise pending.
UPDATE predictions
SET
  resolve_at = COALESCE(resolve_at, expires_at),
  status = CASE
    WHEN outcome = 'correct' THEN 'correct'
    WHEN outcome = 'incorrect' THEN 'incorrect'
    ELSE 'pending'
  END
WHERE status IS NULL;

-- Make sure new rows get pending by default (optional; depends on DB constraints)
ALTER TABLE predictions
ALTER COLUMN status SET DEFAULT 'pending';
