import { Router } from "express";
import { getCandles, getTicks, getLatestPrice, SUPPORTED_SYMBOLS } from "../lib/derivWs.js";
import { calculateAllIndicators, detectMarketCondition } from "../lib/indicators.js";

const router: Router = Router();

router.get("/market/symbols", (_req, res) => {
  res.json(SUPPORTED_SYMBOLS);
});

router.get("/market/candles", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");
  const granularity = parseInt(String(req.query.granularity ?? "60"), 10);
  const count = Math.min(parseInt(String(req.query.count ?? "100"), 10), 300);

  try {
    const candles = await getCandles(symbol, granularity, count);
    res.json(candles);
  } catch (err) {
    req.log.error({ err }, "Failed to get candles");
    res.status(500).json({ error: "Failed to fetch candles" });
  }
});

router.get("/market/ticks", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");
  const count = Math.min(parseInt(String(req.query.count ?? "50"), 10), 200);

  try {
    const ticks = await getTicks(symbol, count);
    const mapped = ticks.map((t) => ({ ...t, symbol }));
    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "Failed to get ticks");
    res.status(500).json({ error: "Failed to fetch ticks" });
  }
});

router.get("/market/summary", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");

  try {
    const [candles, ticks] = await Promise.all([
      getCandles(symbol, 60, 150),
      getTicks(symbol, 50),
    ]);

    if (candles.length === 0) {
      res.status(503).json({ error: "No market data available" });
      return;
    }

    const indicators = calculateAllIndicators(symbol, candles);
    const cond = detectMarketCondition(indicators);
    const currentPrice = ticks.length > 0 ? ticks[ticks.length - 1].price : candles[candles.length - 1].close;
    const prevPrice = candles.length > 1 ? candles[candles.length - 2].close : currentPrice;
    const priceChange = currentPrice - prevPrice;
    const priceChangePct = prevPrice !== 0 ? (priceChange / prevPrice) * 100 : 0;

    const closes = candles.map((c) => c.close);
    const slice = closes.slice(-20);
    const supportLevel = slice.length > 0 ? Math.min(...slice) : null;
    const resistanceLevel = slice.length > 0 ? Math.max(...slice) : null;

    res.json({
      symbol,
      currentPrice,
      priceChange: parseFloat(priceChange.toFixed(5)),
      priceChangePct: parseFloat(priceChangePct.toFixed(4)),
      trend: cond.trend,
      volatility: cond.volatility,
      volatilityValue: cond.volatilityValue,
      momentum: cond.momentum,
      marketCondition: cond.marketCondition,
      supportLevel,
      resistanceLevel,
      spikeDetected: cond.spikeDetected,
      reversalWarning: cond.reversalWarning,
      lastUpdated: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get market summary");
    res.status(500).json({ error: "Failed to get market summary" });
  }
});

export default router;
