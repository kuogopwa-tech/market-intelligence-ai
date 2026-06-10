// Root API index — keep lightweight and avoid exporting the Express app directly.
// Use dedicated serverless functions under /api/* (e.g., /api/ai/status) instead.

export default function handler(_req: any, res: any) {
  res.status(404).json({ error: "Use specific API endpoints under /api/* (e.g., /api/ai/status)" });
}
