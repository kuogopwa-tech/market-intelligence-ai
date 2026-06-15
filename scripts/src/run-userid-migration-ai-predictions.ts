import { pool } from "@workspace/db";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const migrationPath = path.join(
    process.cwd(),
    "scripts",
    "migrations",
    "20260614_000001_add_user_id_to_ai_analysis_and_predictions.sql",
  );

  const sql = await fs.readFile(migrationPath, "utf8");

  console.log(`Executing SQL migration: ${migrationPath}`);
  await pool.query(sql);
  console.log("Migration executed successfully.");

  // Verify columns exist
  const verify = await pool.query(
    `
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name IN ('ai_analysis','predictions')
      AND column_name = 'user_id'
    ORDER BY table_name;
  `,
  );

  console.table(verify.rows);

  await pool.end();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
