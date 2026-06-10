import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from the artifact directory to ensure correct key is used
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../.env") });

import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startBackgroundScanner } from "./lib/backgroundScanner.js";
import { JWT_SECRET } from "./lib/config.js"; // Ensure secret is validated on startup
import { checkDbConnection } from "@workspace/db";
import { checkAiOnline } from "./lib/aiService.js";

// port will be determined at runtime for local development only

const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;

if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000;
  app.listen(port, async (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Perform Startup Diagnostics
    const dbConnected = await checkDbConnection();
    const aiStatus = await checkAiOnline();

    const diagnostics = [
      `DATABASE: ${dbConnected ? "CONNECTED" : "DISCONNECTED"}`,
      `GEMINI: ${aiStatus.online ? "ONLINE" : "FALLBACK (invalid or missing key)"}`,
      `BACKGROUND_SCANNER: ${dbConnected ? "ENABLED" : "DISABLED"}`,
    ];

    console.log("\n--- STARTUP DIAGNOSTICS ---");
    diagnostics.forEach((d) => console.log(d));
    console.log("---------------------------\n");

    if (dbConnected) {
      startBackgroundScanner();
    } else {
      logger.warn("Background scanner disabled because database is unreachable.");
    }
  });
} else {
  logger.info("Running in Vercel environment, skipping app.listen() and background scanner");
}

