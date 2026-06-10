// Vercel serverless catch-all handler for /api/*
// For production on Vercel, this forwards all API requests to the Express app

import app from "../artifacts/api-server/src/app";

export default function handler(req: any, res: any) {
  // Express app is compatible with Node's req/res objects provided by Vercel
  return app(req, res);
}
