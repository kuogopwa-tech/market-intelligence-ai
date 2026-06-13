/**
 * Run migration to add missing columns to users table
 * Usage: pnpm --filter "@workspace/scripts" run-migration
 */
import { pool } from "@workspace/db";

async function runMigration() {
  console.log("Running migration: Adding last_active_at and is_online columns...");
  
  try {
    // Add last_active_at column
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;
    `);
    console.log("✓ Added last_active_at column");
    
    // Add is_online column
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log("✓ Added is_online column");
    
    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log("\nusers table columns:");
    console.table(result.rows);
    
    console.log("\n✅ Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
