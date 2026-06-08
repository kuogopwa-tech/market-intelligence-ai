import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the artifact directory to ensure correct key is used
// Note: In development we use src/index.ts, in production dist/index.mjs
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../.env") });
// Also load from root .env as fallback/complement if needed, but primary is the one above
config({ path: path.resolve(__dirname, "../../../.env") });

import app from "./app";
import { logger } from "./lib/logger";
import { startBackgroundScanner } from "./lib/backgroundScanner";
import { JWT_SECRET } from "./lib/config"; // Ensure secret is validated on startup

// Safe startup logging for Gemini API Key
const geminiKey = process.env.GEMINI_API_KEY;
logger.info(`Gemini key detected: ${geminiKey ? "YES" : "NO"}`);
if (geminiKey && !geminiKey.startsWith("AIza")) {
  logger.warn("Gemini key detected but does not start with 'AIza'. It might be invalid.");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;

if (!isVercel) {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startBackgroundScanner();
  });
} else {
  logger.info("Running in Vercel environment, skipping app.listen() and background scanner");
}
