import { config } from "dotenv";
config();

console.log("GEMINI KEY LOADED (VERCEL):", {
  exists: !!process.env.GEMINI_API_KEY,
  prefix: process.env.GEMINI_API_KEY?.slice(0, 4),
  length: process.env.GEMINI_API_KEY?.length
});

import app from "../artifacts/api-server/src/app";

export default app;