-- Migration: Add last_active_at column to users table
-- Run this SQL against your PostgreSQL database to fix the login error

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
