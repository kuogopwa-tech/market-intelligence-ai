import { Router } from "express";
import { getCandles } from "../lib/derivWs.js";
import { calculateAllIndicators } from "../lib/indicators.js";

const router: Router = Router();

router.get("/indicators", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");
  const granularity = parseInt(String(req.query.granularity ?? "60"), 10);

  try {
    const candles = await getCandles(symbol, granularity, 200);

    if (candles.length < 20) {
      res.status(503).json({ error: "Not enough candle data for indicators" });
      return;
    }

    const indicators = calculateAllIndicators(symbol, candles);
    res.json(indicators);
  } catch (err) {
    req.log.error({ err }, "Failed to calculate indicators");
    res.status(500).json({ error: "Failed to calculate indicators" });
  }
});

export default router;
