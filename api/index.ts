import { config } from "dotenv";
config();

console.log("GEMINI KEY LOADED (VERCEL):", {
  exists: !!process.env.GEMINI_API_KEY,
  prefix: process.env.GEMINI_API_KEY?.slice(0, 4),
  length: process.env.GEMINI_API_KEY?.length
});

import app from "../artifacts/api-server/src/app";
import { logger } from "../artifacts/api-server/src/lib/logger";

logger.info("Serverless API entry point initialized");

export default app;