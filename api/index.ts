import { config } from "dotenv";
config();

const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

if (!isProduction) {
  console.log("GEMINI KEY LOADED (DEV):", {
    exists: !!process.env.GEMINI_API_KEY,
    prefix: process.env.GEMINI_API_KEY?.slice(0, 4),
    length: process.env.GEMINI_API_KEY?.length
  });
}

import app from "../artifacts/api-server/src/app";
import { logger } from "../artifacts/api-server/src/lib/logger";

logger.info("Serverless API entry point initialized");

export default app;