-- Migration: Add last_active_at and is_online columns to users table
-- Timestamp: 20250115_000000
-- Description: Add user activity tracking columns to support online status and last active timestamp
-- 
-- This migration is:
-- - NON-DESTRUCTIVE: Only adds columns, does not modify existing data
-- - SAFE: Uses IF NOT EXISTS to handle re-runs
-- - IDEMPOTENT: Can be run multiple times without error
-- 
-- Affected columns:
--   + last_active_at TIMESTAMP (nullable, no default)
--   + is_online BOOLEAN NOT NULL DEFAULT FALSE
-- 
-- Existing data is PRESERVED:
--   - All existing rows will have last_active_at = NULL
--   - All existing rows will have is_online = FALSE
-- 
-- Columns NOT modified:
--   - id
--   - email
--   - password_hash
--   - role
--   - created_at

-- Add last_active_at column (nullable timestamp for user activity tracking)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;

-- Add is_online column (boolean flag for user online status)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
