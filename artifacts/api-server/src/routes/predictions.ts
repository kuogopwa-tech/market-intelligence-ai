import { Router } from "express";
import { db } from "@workspace/db";
import { predictionsTable, learningMemoryTable } from "@workspace/db";
import { eq, desc, sql, isNull, and, gt } from "drizzle-orm";
import { CreatePredictionBody, UpdatePredictionOutcomeBody, UpdatePredictionOutcomeParams } from "@workspace/api-zod";
import { getCandles } from "../lib/derivWs";
import { calculateAllIndicators } from "../lib/indicators";
import { mergeSignals } from "../lib/signalEngine";
import { classifyIndicatorPattern } from "../lib/patternEngine";

const router: Router = Router();

function formatPrediction(r: typeof predictionsTable.$inferSelect) {
  return {
    id: r.id,
    symbol: r.symbol,
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

async function autoEvaluatePending(symbol: string, currentPrice: number): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(predictionsTable)
      .where(eq(predictionsTable.symbol, symbol))
      .orderBy(desc(predictionsTable.createdAt))
      .limit(20);

    const stalePending = pending.filter((p) => {
      if (p.outcome !== null) return false;
      const ageMs = Date.now() - p.createdAt.getTime();
      return ageMs > 5 * 60 * 1000; // older than 5 minutes
    });

    for (const pred of stalePending) {
      const priceDiff = Math.abs(currentPrice - pred.entryPrice) / pred.entryPrice;
      if (priceDiff < 0.0002) continue; // price hasn't moved enough

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
      await db.insert(learningMemoryTable).values({
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
    }
  } catch {
    // Non-critical — don't fail the request
  }
}

router.get("/predictions", async (req, res) => {
  const symbol = req.query.symbol ? String(req.query.symbol) : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

  try {
    const query = db.select().from(predictionsTable);
    const rows = await (symbol
      ? query.where(eq(predictionsTable.symbol, symbol)).orderBy(desc(predictionsTable.createdAt)).limit(limit)
      : query.orderBy(desc(predictionsTable.createdAt)).limit(limit));

    res.json(rows.map(formatPrediction));
  } catch (err) {
    req.log.error({ err }, "Failed to get predictions");
    res.status(500).json({ error: "Failed to get predictions" });
  }
});

router.post("/predictions", async (req, res) => {
  const parsed = CreatePredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { symbol, direction, confidence, entryPrice, analysisId, indicators } = parsed.data;

  try {
    const [row] = await db
      .insert(predictionsTable)
      .values({
        symbol,
        direction,
        confidence,
        entryPrice,
        analysisId: analysisId ?? null,
        indicators: indicators as Record<string, unknown>,
      })
      .returning();

    res.status(201).json(formatPrediction(row));
  } catch (err) {
    req.log.error({ err, symbol, direction }, "Failed to create prediction in database");
    res.status(500).json({ error: "Failed to create prediction" });
  }
});

router.patch("/predictions/:id/outcome", async (req, res) => {
  const paramsResult = UpdatePredictionOutcomeParams.safeParse({ id: parseInt(req.params.id, 10) });
  const bodyResult = UpdatePredictionOutcomeBody.safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { id } = paramsResult.data;
  const { outcome, exitPrice } = bodyResult.data;

  try {
    const existing = await db
      .select()
      .from(predictionsTable)
      .where(eq(predictionsTable.id, id))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Prediction not found" });
      return;
    }

    const [updated] = await db
      .update(predictionsTable)
      .set({ outcome, exitPrice, resolvedAt: Math.floor(Date.now() / 1000) })
      .where(eq(predictionsTable.id, id))
      .returning();

    const pred = existing[0];
    const patternName =
      (pred.indicators as Record<string, unknown>)?.patternName as string ?? "prediction_outcome";

    await db.insert(learningMemoryTable).values({
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

    res.json(formatPrediction(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update prediction outcome");
    res.status(500).json({ error: "Failed to update outcome" });
  }
});

router.get("/predictions/accuracy", async (req, res) => {
  try {
    const rows = await db
      .select({
        symbol: predictionsTable.symbol,
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${predictionsTable.outcome} = 'correct')::int`,
        incorrect: sql<number>`count(*) filter (where ${predictionsTable.outcome} = 'incorrect')::int`,
        pending: sql<number>`count(*) filter (where ${predictionsTable.outcome} is null)::int`,
      })
      .from(predictionsTable)
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

router.post("/predictions/auto", async (req, res) => {
  const symbol = String(req.body?.symbol ?? "R_100");

  try {
    const candles = await getCandles(symbol, 60, 200);
    if (candles.length < 20) {
      res.status(503).json({ error: "Insufficient market data" });
      return;
    }

    const currentPrice = candles[candles.length - 1].close;

    // Auto-evaluate any stale pending predictions
    await autoEvaluatePending(symbol, currentPrice);

    // Check for duplicate pending prediction within last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const [existingPrediction] = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
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

    const [row] = await db
      .insert(predictionsTable)
      .values({
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
