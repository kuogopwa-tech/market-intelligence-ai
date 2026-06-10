// Vercel CommonJS environment may use require() to load this file.
// Use dynamic import to load the ESM Express app from artifacts, avoiding ERR_REQUIRE_ESM.
import type { IncomingMessage, ServerResponse } from "http";

let cachedApp: any = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedApp) {
    const mod = await import("../artifacts/api-server/dist/app.js");
    cachedApp = (mod && (mod as any).default) ? (mod as any).default : mod;
  }

  // Express application is a callable request handler: app(req, res, next)
  return (cachedApp as any)(req as any, res as any);
}