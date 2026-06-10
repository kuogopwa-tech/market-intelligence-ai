export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).end();
    return;
  }

  // Simple auth check for cron
  const authHeader = req.headers?.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Lazy-load background scanner implementation
    const bg = await import("../../artifacts/api-server/src/lib/backgroundScanner");
    if (typeof bg.runBackgroundScan !== "function") {
      res.status(500).json({ error: "Background scan not available" });
      return;
    }

    // Start scan. For serverless we attempt to await it; if it is long-running this may time out.
    // The scanner itself checks DB connectivity and will bail out if DB is unavailable.
    try {
      await bg.runBackgroundScan();
      const status = typeof bg.getSchedulerStatus === "function" ? bg.getSchedulerStatus() : null;
      res.json({ success: true, status });
    } catch (innerErr) {
      const message = innerErr instanceof Error ? innerErr.message : String(innerErr);
      res.status(500).json({ error: "Cron scan failed", details: message });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to run cron", details: message });
  }
}
