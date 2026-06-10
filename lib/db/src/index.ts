import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn(
    "WARNING: DATABASE_URL is not set. Database features will be disabled.",
  );
}

export const pool = new Pool(dbUrl ? { connectionString: dbUrl } : { host: "localhost", port: 5432, user: "placeholder" });
export const db = drizzle(pool, { schema });

/**
 * Checks if the database is reachable.
 */
export async function checkDbConnection(): Promise<boolean> {
  if (!dbUrl) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    return false;
  }
}

export * from "./schema";

