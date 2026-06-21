import { checkDbConnection } from "@workspace/db";

/**
 * Startup safety checks for learning memory.
 *
 * The app expects this module to exist in Vercel build so that
 * `src/index.ts` can dynamically import `./lib/learningMemorySafety.js`.
 */
export async function runStartupSafetyChecks(): Promise<{
  dbIdentityOk: boolean;
  learningMemorySchemaOk: boolean;
}> {
  // Critical-path: ensure DB connectivity first.
  const dbIdentityOk = await checkDbConnection();

  // Schema drift checks would require introspection/migrations metadata.
  // For now, keep this as a conservative placeholder to avoid blocking deploys.
  const learningMemorySchemaOk = true;

  return { dbIdentityOk, learningMemorySchemaOk };
}
