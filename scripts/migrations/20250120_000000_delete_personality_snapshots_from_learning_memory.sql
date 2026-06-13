-- Migration: Delete personality_snapshot and other system events from learning_memory
-- Learning memory should only store tradeable market patterns, NOT system events
-- 
-- Allowed patterns:
--   - Bullish Continuation
--   - Bearish Continuation
--   - Bullish Exhaustion
--   - Bearish Exhaustion
--   - High Volatility Spike
--   - Low Volatility Consolidation
--   - Double Oversold
--   - Double Overbought
--   - Bullish Reversal Signal
--   - Bearish Reversal Signal
--   - Mixed Signals
--   - prediction_outcome
--   - regime_shift
--
-- Blocked patterns (to be deleted):
--   - personality_snapshot
--   - hourly_summary
--   - daily_summary

-- Delete personality_snapshot records
DELETE FROM learning_memory 
WHERE pattern_type = 'personality_snapshot';

-- Delete hourly_summary records  
DELETE FROM learning_memory 
WHERE pattern_type = 'hourly_summary';

-- Delete daily_summary records
DELETE FROM learning_memory 
WHERE pattern_type = 'daily_summary';

-- Verify remaining records are valid trade patterns
SELECT 
  pattern_type,
  COUNT(*) as count
FROM learning_memory
GROUP BY pattern_type
ORDER BY count DESC;
