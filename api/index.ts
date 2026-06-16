import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";

let cachedApp: any = null;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<any> {
  if (!cachedApp) {
    try {
      // Check if dist/app.js exists
      const appPath = path.join(process.cwd(), "artifacts/api-server/dist/app.js");
      console.log("[api] Looking for app at:", appPath);
      console.log("[api] File exists:", fs.existsSync(appPath));
      
      const mod = await import("../artifacts/api-server/dist/app.js");
      cachedApp = mod.default || mod;
      console.log("[api] Express app loaded successfully");
    } catch (err) {
      console.error("[api] Failed to load app.js:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error - Failed to load API", details: String(err) }));
      return;
    }
  }

  return cachedApp(req, res);
}