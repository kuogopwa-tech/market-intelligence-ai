import type { IncomingMessage, ServerResponse } from "http";

let cachedApp: any = null;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<any> {
  if (!cachedApp) {
    try {
      const mod = await import("../artifacts/api-server/dist/app.js");
      cachedApp = mod.default || mod;
      console.log("[api] Express app loaded successfully");
    } catch (err) {
      console.error("[api] Failed to load app.js:", err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Internal Server Error - Failed to load API" }));
      return;
    }
  }

  return cachedApp(req, res);
}