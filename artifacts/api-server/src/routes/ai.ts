import { Router } from "express";
import { checkAiOnline } from "../lib/aiService.js";

const router: Router = Router();

router.get("/ai/status", async (_req, res) => {
  const status = await checkAiOnline();
  res.json(status);
});

export default router;
