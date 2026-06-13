-- Migration: Create all base tables
-- Timestamp: 20250115_000001
-- Description: Create all Drizzle schema tables in PostgreSQL
-- 
-- This migration is:
-- - NON-DESTRUCTIVE: Only creates tables (IF NOT EXISTS)
-- - SAFE: Uses IF NOT EXISTS to handle re-runs
-- - IDEMPOTENT: Can be run multiple times without error
-- 
-- Tables created:
--   1. users
--   2. market_data
--   3. ticks
--   4. predictions
--   5. ai_analysis
--   6. learning_memory
--   7. indicators_history
--   8. symbol_timeline
--   9. scan_runs
--  10. intelligence_snapshots
--  11. hourly_summaries
--  12. daily_summaries

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  last_active_at TIMESTAMP,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. MARKET_DATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS market_data (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  epoch BIGINT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  granularity INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. TICKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ticks (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  epoch BIGINT NOT NULL,
  price REAL NOT NULL,
  bid REAL,
  ask REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. PREDICTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  confidence REAL NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL,
  outcome TEXT,
  analysis_id INTEGER,
  market_state TEXT,
  indicators JSONB NOT NULL DEFAULT '{}',
  resolved_at BIGINT,
  expires_at BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. AI_ANALYSIS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_analysis (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  rise_probability REAL NOT NULL,
  fall_probability REAL NOT NULL,
  confidence REAL NOT NULL,
  market_condition TEXT NOT NULL,
  market_state TEXT,
  risk_level TEXT,
  bullish_score REAL,
  bearish_score REAL,
  no_trade_zone INTEGER NOT NULL DEFAULT 0,
  signals JSONB NOT NULL DEFAULT '[]',
  warnings JSONB NOT NULL DEFAULT '[]',
  ai_model TEXT,
  cached INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. LEARNING_MEMORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS learning_memory (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL DEFAULT '{}',
  outcome TEXT NOT NULL,
  accuracy REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 7. INDICATORS_HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS indicators_history (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  granularity TEXT NOT NULL DEFAULT '60',
  rsi REAL,
  macd_line REAL,
  macd_signal REAL,
  macd_histogram REAL,
  ema9 REAL,
  ema21 REAL,
  ema50 REAL,
  sma20 REAL,
  bollinger_upper REAL,
  bollinger_middle REAL,
  bollinger_lower REAL,
  atr REAL,
  stochastic_k REAL,
  stochastic_d REAL,
  trend_strength REAL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- 8. SYMBOL_TIMELINE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS symbol_timeline (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  snapshot_at TIMESTAMP NOT NULL DEFAULT NOW(),
  hour INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  clean_signal_score INTEGER NOT NULL,
  risk_score INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  market_state TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  volatility_compatibility INTEGER NOT NULL,
  indicator_alignment INTEGER NOT NULL,
  momentum_confirmation INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  priority_level TEXT NOT NULL,
  market_cleanliness TEXT NOT NULL,
  setup_rarity TEXT NOT NULL,
  bullish_score INTEGER NOT NULL,
  bearish_score INTEGER NOT NULL,
  no_trade_zone BOOLEAN NOT NULL,
  pattern_name TEXT NOT NULL
);

-- Create indexes for symbol_timeline
CREATE INDEX IF NOT EXISTS st_symbol_idx ON symbol_timeline(symbol);
CREATE INDEX IF NOT EXISTS st_snapshot_at_idx ON symbol_timeline(snapshot_at);
CREATE INDEX IF NOT EXISTS st_symbol_hour_idx ON symbol_timeline(symbol, hour);

-- ============================================
-- 9. SCAN_RUNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  symbols_scanned INTEGER DEFAULT 0 NOT NULL,
  symbols_succeeded INTEGER DEFAULT 0 NOT NULL,
  symbols_failed INTEGER DEFAULT 0 NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'scheduler',
  error TEXT
);

-- Create index for scan_runs
CREATE INDEX IF NOT EXISTS sr_started_at_idx ON scan_runs(started_at);

-- ============================================
-- 10. INTELLIGENCE_SNAPSHOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS intelligence_snapshots (
  id SERIAL PRIMARY KEY,
  scan_run_id INTEGER,
  symbol TEXT NOT NULL,
  snapshot_at TIMESTAMP NOT NULL DEFAULT NOW(),
  hour INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  clean_signal_score INTEGER NOT NULL,
  risk_score INTEGER NOT NULL,
  confidence INTEGER NOT NULL,
  market_state TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  priority_level TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  market_cleanliness TEXT NOT NULL,
  setup_rarity TEXT NOT NULL,
  volatility_compatibility INTEGER NOT NULL,
  indicator_alignment INTEGER NOT NULL,
  momentum_confirmation INTEGER NOT NULL,
  bullish_score INTEGER NOT NULL,
  bearish_score INTEGER NOT NULL,
  no_trade_zone BOOLEAN NOT NULL,
  pattern_name TEXT NOT NULL
);

-- Create indexes for intelligence_snapshots
CREATE INDEX IF NOT EXISTS is_symbol_idx ON intelligence_snapshots(symbol);
CREATE INDEX IF NOT EXISTS is_snapshot_at_idx ON intelligence_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS is_symbol_hour_idx ON intelligence_snapshots(symbol, hour);
CREATE INDEX IF NOT EXISTS is_scan_run_id_idx ON intelligence_snapshots(scan_run_id);

-- ============================================
-- 11. HOURLY_SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS hourly_summaries (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  avg_quality REAL NOT NULL,
  avg_confidence REAL NOT NULL,
  avg_risk REAL NOT NULL,
  avg_volatility_compat REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  elite_count INTEGER DEFAULT 0 NOT NULL,
  dangerous_count INTEGER DEFAULT 0 NOT NULL,
  no_trade_count INTEGER DEFAULT 0 NOT NULL,
  dominant_state TEXT NOT NULL,
  dominant_pattern TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for hourly_summaries
CREATE UNIQUE INDEX IF NOT EXISTS hs_symbol_date_hour_idx ON hourly_summaries(symbol, date, hour);
CREATE INDEX IF NOT EXISTS hs_symbol_idx ON hourly_summaries(symbol);
CREATE INDEX IF NOT EXISTS hs_date_idx ON hourly_summaries(date);

-- ============================================
-- 12. DAILY_SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS daily_summaries (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  avg_quality REAL NOT NULL,
  avg_confidence REAL NOT NULL,
  avg_risk REAL NOT NULL,
  sample_count INTEGER NOT NULL,
  elite_count INTEGER DEFAULT 0 NOT NULL,
  dangerous_count INTEGER DEFAULT 0 NOT NULL,
  peak_quality_hour INTEGER,
  worst_quality_hour INTEGER,
  dominant_state TEXT NOT NULL,
  dominant_personality TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for daily_summaries
CREATE UNIQUE INDEX IF NOT EXISTS ds_symbol_date_idx ON daily_summaries(symbol, date);
CREATE INDEX IF NOT EXISTS ds_symbol_idx ON daily_summaries(symbol);
CREATE INDEX IF NOT EXISTS ds_date_idx ON daily_summaries(date);
