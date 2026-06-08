import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { startBackgroundScanner } from "./lib/backgroundScanner";
import { JWT_SECRET } from "./lib/config"; // Ensure secret is validated on startup

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
