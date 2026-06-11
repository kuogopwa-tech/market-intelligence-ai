import type { IncomingMessage, ServerResponse } from "http";

let cachedApp: any = null;

async function handler(req: IncomingMessage, res: ServerResponse): Promise<any> {
  if (!cachedApp) {
    try {
      const mod = await import("../artifacts/api-server/dist/app.js");
      cachedApp = mod.default || mod;
    } catch (err) {
      console.error("[api] Failed to load app.js:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
      return;
    }
  }

  // Express app is callable as middleware/handler
  return cachedApp(req, res);
}

export default handler;