/**
 * Migration script: Add last_active_at column to users table
 * Run with: pnpm create:migration
 */
import { pool, db } from "@workspace/db";

async function migrate() {
  console.log("Running migration: Adding last_active_at column to users table...");
  
  try {
    // Add the column if it doesn't exist
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
    `);
    
    console.log("✅ Migration successful: last_active_at column added to users table");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
