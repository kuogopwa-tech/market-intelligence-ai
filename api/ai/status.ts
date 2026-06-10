export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end();
    return;
  }

  try {
    // Lazy-load AI health check to avoid importing heavy libs at module load time
    const ai = await import("../../artifacts/api-server/src/lib/aiService");
    if (typeof ai.checkAiOnline !== "function") {
      res.status(500).json({ online: false, error: "AI health check not available" });
      return;
    }

    const status = await ai.checkAiOnline();
    res.status(200).json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ online: false, model: process.env.AI_MODEL ?? null, provider: "gemini", responseTimeMs: null, error: message });
  }
}
