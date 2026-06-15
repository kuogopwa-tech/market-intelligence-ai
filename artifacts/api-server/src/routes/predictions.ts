import { Router } from "express";
import { db } from "@workspace/db";
import { predictionsTable, learningMemoryTable } from "@workspace/db";
import { eq, desc, sql, isNull, and, gt } from "drizzle-orm";
import { CreatePredictionBody, UpdatePredictionOutcomeBody, UpdatePredictionOutcomeParams } from "@workspace/api-zod";
import { getCandles, getLatestPrice } from "../lib/derivWs.js";
import { calculateAllIndicators } from "../lib/indicators.js";
import { mergeSignals } from "../lib/signalEngine.js";
import { classifyIndicatorPattern } from "../lib/patternEngine.js";
import { requireAuth } from "../middleware/auth.js";

const router: Router = Router();

function formatPrediction(r: typeof predictionsTable.$inferSelect) {
  return {
    id: r.id,
    userId: r.userId,
    symbol: r.symbol,
    interval: r.interval,
    direction: r.direction,
    confidence: r.confidence,
    entryPrice: r.entryPrice,
    exitPrice: r.exitPrice,
    outcome: r.outcome,
    analysisId: r.analysisId,
    marketState: r.marketState ?? null,
    indicators: r.indicators as Record<string, unknown>,
    resolvedAt: r.resolvedAt,
    expiresAt: r.expiresAt ?? null,
    createdAt: Math.floor(r.createdAt.getTime() / 1000),
  };
}

async function autoEvaluatePending(userId: string, symbol: string, currentPrice: number): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.symbol, symbol),
          eq(predictionsTable.userId, userId),
          isNull(predictionsTable.outcome)
        )
      )
      .orderBy(desc(predictionsTable.createdAt))
      .limit(20);

    for (const pred of pending) {
      const nowS = Math.floor(Date.now() / 1000);
      const isExpired = pred.expiresAt ? nowS >= pred.expiresAt : (Date.now() - pred.createdAt.getTime() > 5 * 60 * 1000);
      
      const priceDiff = Math.abs(currentPrice - pred.entryPrice) / pred.entryPrice;
      
      // Evaluate if expired OR if price moved significantly (0.05%)
      if (!isExpired && priceDiff < 0.0005) continue;

      let outcome: "correct" | "incorrect";
      if (pred.direction === "rise") {
        outcome = currentPrice > pred.entryPrice ? "correct" : "incorrect";
      } else if (pred.direction === "fall") {
        outcome = currentPrice < pred.entryPrice ? "correct" : "incorrect";
      } else {
        continue;
      }

      await db
        .update(predictionsTable)
        .set({ outcome, exitPrice: currentPrice, resolvedAt: Math.floor(Date.now() / 1000) })
        .where(eq(predictionsTable.id, pred.id));

      // Store in learning memory
      {
        const userId = pred.userId;

        console.log("AUTH_USER_ID", undefined);
        console.log("INSERT_USER_ID", userId);

        const insertedRow = await db.insert(learningMemoryTable).values({
          userId: pred.userId,
          symbol: pred.symbol,
          patternType: (pred.indicators as Record<string, unknown>)?.patternName as string ?? "prediction_outcome",
          patternData: {
            direction: pred.direction,
            confidence: pred.confidence,
            marketState: pred.marketState,
            indicators: pred.indicators,
            autoEvaluated: true,
          },
          outcome,
          accuracy: outcome === "correct" ? pred.confidence : 100 - pred.confidence,
        });

        console.log("INSERT_RESULT", insertedRow);
      }
    }
  } catch {
    // Non-critical — don't fail the request
  }
}

router.get("/predictions", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  const symbol = req.query.symbol ? String(req.query.symbol) : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

  try {
    // Auto-evaluate pending predictions for this symbol if provided
    if (symbol) {
      const price = getLatestPrice(symbol);
      if (price) {
        await autoEvaluatePending(userId, symbol, price);
      } else {
        const candles = await getCandles(symbol, 60, 1);
        if (candles.length > 0) await autoEvaluatePending(userId, symbol, candles[0].close);
      }
    }

    const filters = [eq(predictionsTable.userId, userId)];
    if (symbol) {
      filters.push(eq(predictionsTable.symbol, symbol));
    }

    const rows = await db
      .select()
      .from(predictionsTable)
      .where(and(...filters))
      .orderBy(desc(predictionsTable.createdAt))
      .limit(limit);

    res.json(rows.map(formatPrediction));
  } catch (err) {
    req.log.error({ err }, "Failed to get predictions");
    res.status(500).json({ error: "Failed to get predictions" });
  }
});

router.post("/predictions", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  const parsed = CreatePredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { symbol, direction, confidence, entryPrice, analysisId, indicators } = parsed.data;

  try {
    console.log("AUTH_USER_ID", req.user?.id);
    console.log("INSERT_USER_ID", userId);

    const [row] = await db
      .insert(predictionsTable)
      .values({
        userId,
        symbol,
        direction,
        confidence,
        entryPrice,
        analysisId: analysisId ?? null,
        indicators: indicators as Record<string, unknown>,
      })
      .returning();

    console.log("INSERT_RESULT", row);

    res.status(201).json(formatPrediction(row));
  } catch (err) {
    req.log.error({ err, symbol, direction }, "Failed to create prediction in database");
    res.status(500).json({ error: "Failed to create prediction" });
  }
});

router.patch("/predictions/:id/outcome", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(String(rawId), 10);

  const paramsResult = UpdatePredictionOutcomeParams.safeParse({
    id,
  });
  const bodyResult = UpdatePredictionOutcomeBody.safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { outcome, exitPrice } = bodyResult.data;
  const predictionId = paramsResult.data.id;

  try {
    const existing = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.id, predictionId),
          eq(predictionsTable.userId, userId),
        )
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Prediction not found" });
      return;
    }

    const [updated] = await db
      .update(predictionsTable)
      .set({ outcome, exitPrice, resolvedAt: Math.floor(Date.now() / 1000) })
      .where(
        and(
          eq(predictionsTable.id, predictionId),
          eq(predictionsTable.userId, userId),
        )
      )
      .returning();

    const pred = existing[0];
    const patternName =
      (pred.indicators as Record<string, unknown>)?.patternName as string ?? "prediction_outcome";

    console.log("AUTH_USER_ID", req.user?.id);
    console.log("INSERT_USER_ID", userId);

    const insertedRow = await db.insert(learningMemoryTable).values({
      userId,
      symbol: pred.symbol,
      patternType: patternName,
      patternData: {
        direction: pred.direction,
        confidence: pred.confidence,
        marketState: pred.marketState,
        indicators: pred.indicators,
      },
      outcome,
      accuracy: outcome === "correct" ? pred.confidence : 100 - pred.confidence,
    });

    console.log("INSERT_RESULT", insertedRow);

    res.json(formatPrediction(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update prediction outcome");
    res.status(500).json({ error: "Failed to update outcome" });
  }
});

router.get("/predictions/accuracy", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  try {
    // Auto-evaluate pending predictions for active symbols
    const pendingSymbols = await db
      .selectDistinct({ symbol: predictionsTable.symbol })
      .from(predictionsTable)
      .where(and(eq(predictionsTable.userId, userId), isNull(predictionsTable.outcome)));
    
    for (const { symbol } of pendingSymbols) {
       const price = getLatestPrice(symbol);
       if (price) {
         await autoEvaluatePending(userId, symbol, price);
       } else {
         const candles = await getCandles(symbol, 60, 1);
         if (candles.length > 0) await autoEvaluatePending(userId, symbol, candles[0].close);
       }
    }

    const rows = await db
      .select({
        symbol: predictionsTable.symbol,
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${predictionsTable.outcome} = 'correct')::int`,
        incorrect: sql<number>`count(*) filter (where ${predictionsTable.outcome} = 'incorrect')::int`,
        pending: sql<number>`count(*) filter (where ${predictionsTable.outcome} is null)::int`,
      })
      .from(predictionsTable)
      .where(eq(predictionsTable.userId, userId))
      .groupBy(predictionsTable.symbol);

    res.json(
      rows.map((r) => ({
        symbol: r.symbol,
        total: r.total,
        correct: r.correct,
        incorrect: r.incorrect,
        pending: r.pending,
        accuracy:
          r.total > 0
            ? parseFloat(((r.correct / (r.correct + r.incorrect || 1)) * 100).toFixed(1))
            : 0,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get accuracy stats");
    res.status(500).json({ error: "Failed to get accuracy stats" });
  }
});

router.post("/predictions/auto", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  const symbol = String(req.body?.symbol ?? "R_100");

  try {
    const candles = await getCandles(symbol, 60, 200);
    if (candles.length < 20) {
      res.status(503).json({ error: "Insufficient market data" });
      return;
    }

    const currentPrice = candles[candles.length - 1].close;

    // Auto-evaluate any stale pending predictions for this user
    await autoEvaluatePending(userId, symbol, currentPrice);

    // Check for duplicate pending prediction within last 60 seconds for this user
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const [existingPrediction] = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.userId, userId),
          eq(predictionsTable.symbol, symbol),
          isNull(predictionsTable.outcome),
          gt(predictionsTable.createdAt, oneMinuteAgo)
        )
      )
      .limit(1);

    if (existingPrediction) {
      res.json({
        generated: false,
        duplicate: true,
        reason: "Recent pending prediction already exists",
        prediction: formatPrediction(existingPrediction),
      });
      return;
    }

    const indicators = calculateAllIndicators(symbol, candles);
    const signals = mergeSignals(indicators);
    const pattern = classifyIndicatorPattern(indicators);

    if (signals.noTradeZone) {
      res.json({
        generated: false,
        reason: `Market conditions unclear — ${signals.marketState}. Confidence ${signals.confidence}% is below the minimum threshold. Signals conflict: ${signals.conflictingSignals.slice(0, 2).join("; ")}. Avoid directional bias.`,
        signals: {
          symbol,
          ...signals,
        },
      });
      return;
    }

    const direction: "rise" | "fall" = signals.bullishScore > 50 ? "rise" : "fall";
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60; // 5 minutes expiry

    console.log("AUTH_USER_ID", req.user?.id);
    console.log("INSERT_USER_ID", userId);

    const [row] = await db
      .insert(predictionsTable)
      .values({
        userId,
        symbol,
        direction,
        confidence: signals.confidence,
        entryPrice: currentPrice,
        marketState: signals.marketState,
        expiresAt,
        indicators: {
          ...indicators,
          patternName: pattern.name,
          bullishScore: signals.bullishScore,
          bearishScore: signals.bearishScore,
          riskLevel: signals.riskLevel,
        },
      })
      .returning();

    console.log("INSERT_RESULT", row);

    res.json({
      generated: true,
      reason: `${signals.marketState} with ${signals.confidence}% confidence. ${direction === "rise" ? "Bullish" : "Bearish"} bias at ${currentPrice.toFixed(4)}. Pattern: ${pattern.name}. Risk: ${signals.riskLevel}.`,
      prediction: formatPrediction(row),
      signals: {
        symbol,
        ...signals,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to auto-generate prediction");
    res.status(500).json({ error: "Failed to auto-generate prediction" });
  }
});

export default router;
