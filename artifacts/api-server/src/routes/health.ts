import { Router, type IRouter } from "express";
import { checkAiOnline } from "../lib/aiService.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    service: "market-intelligence-ai",
    timestamp: new Date().toISOString()
  });
});

router.get("/status", async (_req, res) => {
  const aiStatus = await checkAiOnline();
  
  res.json({
    status: aiStatus.online ? "ok" : "degraded",
    api: "online",
    ai: {
      online: aiStatus.online,
      provider: aiStatus.provider,
      model: aiStatus.model
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
