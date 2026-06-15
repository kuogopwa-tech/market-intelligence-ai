﻿import { Router } from "express";
import { db } from "@workspace/db";
import { predictionsTable, learningMemoryTable } from "@workspace/db";
import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { CreatePredictionBody, UpdatePredictionOutcomeBody, UpdatePredictionOutcomeParams } from "@workspace/api-zod";
import { getCandles, getLatestPrice } from "../lib/derivWs.js";
import { calculateAllIndicators } from "../lib/indicators.js";
import { mergeSignals, computeSignalQuality } from "../lib/signalEngine.js";
import { classifyIndicatorPattern } from "../lib/patternEngine.js";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const router: Router = Router();

const TRADE_DURATION_SECONDS = 60;
const PREDICTION_COOLDOWN_MS = 30000; // 30 seconds cooldown

// Rate limiting storage (userId -> symbol -> lastPredictionTimestamp)
const lastPredictionTimes = new Map<string, Map<string, number>>();

/* -------------------------------------------------------
   RATE LIMIT HELPER
------------------------------------------------------- */
function checkRateLimit(userId: string, symbol: string): { allowed: boolean; remainingSeconds?: number } {
  if (!lastPredictionTimes.has(userId)) {
    lastPredictionTimes.set(userId, new Map());
  }
  
  const userTimes = lastPredictionTimes.get(userId)!;
  const lastTime = userTimes.get(symbol) || 0;
  const now = Date.now();
  const elapsed = now - lastTime;
  
  if (elapsed < PREDICTION_COOLDOWN_MS) {
    return { 
      allowed: false, 
      remainingSeconds: Math.ceil((PREDICTION_COOLDOWN_MS - elapsed) / 1000) 
    };
  }
  
  userTimes.set(symbol, now);
  return { allowed: true };
}

/* -------------------------------------------------------
   FORMATTER
------------------------------------------------------- */
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

/* -------------------------------------------------------
   CORE EVALUATION (WRITE ONLY - NO GET ROUTES CALL IT)
------------------------------------------------------- */
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
      const ageSeconds = Math.floor((Date.now() - pred.createdAt.getTime()) / 1000);

      const isExpired = pred.expiresAt ? nowS >= pred.expiresAt : ageSeconds > 300;
      const priceDiff = Math.abs(currentPrice - pred.entryPrice) / pred.entryPrice;

      // STRICT RULE: Only evaluate if expired OR (age >= trade duration AND meaningful price movement)
      if (!isExpired && ageSeconds < TRADE_DURATION_SECONDS) continue;
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
        .set({
          outcome,
          exitPrice: currentPrice,
          resolvedAt: nowS,
        })
        .where(eq(predictionsTable.id, pred.id));

      await db.insert(learningMemoryTable).values({
        userId: pred.userId,
        symbol: pred.symbol,
        patternType: (pred.indicators as any)?.patternName ?? "prediction_outcome",
        patternData: {
          direction: pred.direction,
          confidence: pred.confidence,
          marketState: pred.marketState,
          indicators: pred.indicators,
        },
        outcome,
        accuracy: outcome === "correct" ? pred.confidence : 100 - pred.confidence,
      });
    }
  } catch (err) {
    logger.error({ err, userId, symbol }, "Auto-evaluation failed");
  }
}

/* -------------------------------------------------------
   GET PREDICTIONS (READ ONLY - NO SIDE EFFECTS)
------------------------------------------------------- */
router.get("/predictions", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  const symbol = req.query.symbol ? String(req.query.symbol) : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

  try {
    const filters = [eq(predictionsTable.userId, userId)];
    if (symbol) filters.push(eq(predictionsTable.symbol, symbol));

    const rows = await db
      .select()
      .from(predictionsTable)
      .where(and(...filters))
      .orderBy(desc(predictionsTable.createdAt))
      .limit(limit);

    return res.json(rows.map(formatPrediction));
  } catch (err) {
    req.log.error({ err }, "Failed to get predictions");
    return res.status(500).json({ error: "Failed to get predictions" });
  }
});

/* -------------------------------------------------------
   GET PREDICTION ACCURACY STATS
------------------------------------------------------- */
router.get("/predictions/accuracy", requireAuth(), async (req, res) => {
  const userId = req.user!.id;

  try {
    const results = await db
      .select({
        symbol: predictionsTable.symbol,
        total: sql<number>`COUNT(*)`,
        correct: sql<number>`SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END)`,
        incorrect: sql<number>`SUM(CASE WHEN outcome = 'incorrect' THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN outcome IS NULL THEN 1 ELSE 0 END)`,
        accuracy: sql<number>`(SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END)::float / NULLIF(SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END), 0) * 100)`,
      })
      .from(predictionsTable)
      .where(eq(predictionsTable.userId, userId))
      .groupBy(predictionsTable.symbol);

    return res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to get accuracy stats");
    return res.status(500).json({ error: "Failed to get accuracy stats" });
  }
});

/* -------------------------------------------------------
   CREATE MANUAL PREDICTION (WRITE)
------------------------------------------------------- */
router.post("/predictions", requireAuth(), async (req, res) => {
  const userId = req.user!.id;

  const parsed = CreatePredictionBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  const { symbol, direction, confidence, entryPrice, analysisId, indicators } = parsed.data;

  try {
    // Check for existing pending prediction
    const [existing] = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.userId, userId),
          eq(predictionsTable.symbol, symbol),
          isNull(predictionsTable.outcome)
        )
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({
        generated: false,
        duplicate: true,
        reason: "You already have a pending prediction for this symbol. Resolve it first.",
        prediction: formatPrediction(existing),
      });
    }

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

    return res.status(201).json(formatPrediction(row));
  } catch (err: any) {
    if (err.code === "23505") {
      const [existing] = await db
        .select()
        .from(predictionsTable)
        .where(
          and(
            eq(predictionsTable.userId, userId),
            eq(predictionsTable.symbol, symbol),
            isNull(predictionsTable.outcome)
          )
        )
        .limit(1);

      return res.json({
        generated: false,
        duplicate: true,
        reason: "Active prediction exists",
        prediction: existing ? formatPrediction(existing) : null,
      });
    }

    req.log.error({ err }, "Create prediction failed");
    return res.status(500).json({ error: "Failed to create prediction" });
  }
});

/* -------------------------------------------------------
   PATCH OUTCOME (WRITE ONLY)
------------------------------------------------------- */
router.patch("/predictions/:id/outcome", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(String(req.params.id), 10);

  const body = UpdatePredictionOutcomeBody.safeParse(req.body);
  const params = UpdatePredictionOutcomeParams.safeParse({ id });

  if (!body.success || !params.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const [updated] = await db
      .update(predictionsTable)
      .set({
        outcome: body.data.outcome,
        exitPrice: body.data.exitPrice,
        resolvedAt: Math.floor(Date.now() / 1000),
      })
      .where(
        and(
          eq(predictionsTable.id, id),
          eq(predictionsTable.userId, userId),
          isNull(predictionsTable.outcome)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    await db.insert(learningMemoryTable).values({
      userId,
      symbol: updated.symbol,
      patternType: (updated.indicators as any)?.patternName ?? "outcome",
      patternData: {
        direction: updated.direction,
        confidence: updated.confidence,
        marketState: updated.marketState,
      },
      outcome: body.data.outcome,
      accuracy: body.data.outcome === "correct" ? updated.confidence : 100 - updated.confidence,
    });

    return res.json(formatPrediction(updated));
  } catch (err) {
    req.log.error({ err }, "Outcome update failed");
    return res.status(500).json({ error: "Failed to update outcome" });
  }
});

/* -------------------------------------------------------
   AUTO PREDICTION (WRITE ONLY WITH RATE LIMITING)
------------------------------------------------------- */
router.post("/predictions/auto", requireAuth(), async (req, res) => {
  const userId = req.user!.id;
  const symbol = String(req.body?.symbol ?? "R_100");

  // RATE LIMIT CHECK
  const rateLimit = checkRateLimit(userId, symbol);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      generated: false,
      reason: `Please wait ${rateLimit.remainingSeconds} seconds before generating another prediction.`,
      rateLimited: true,
    });
  }

  try {
    // Check for existing pending prediction (duplicate prevention)
    const [existingPending] = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.userId, userId),
          eq(predictionsTable.symbol, symbol),
          isNull(predictionsTable.outcome)
        )
      )
      .limit(1);

    if (existingPending) {
      return res.status(409).json({
        generated: false,
        duplicate: true,
        reason: "You already have a pending prediction. Wait for it to resolve or update its outcome.",
        prediction: formatPrediction(existingPending),
      });
    }

    const candles = await getCandles(symbol, 60, 200);
    if (candles.length < 20) {
      return res.status(503).json({ 
        generated: false, 
        reason: "Insufficient market data. Please try again in a few seconds." 
      });
    }

    const currentPrice = candles[candles.length - 1].close;

    const indicators = calculateAllIndicators(symbol, candles);
    const signals = mergeSignals(indicators);
    const signalQuality = computeSignalQuality(signals, indicators);
    const pattern = classifyIndicatorPattern(indicators);

    // No-Trade Zone response (using signalQuality for display properties)
    if (signals.noTradeZone) {
      return res.status(200).json({
        generated: false,
        reason: `⚠️ No-Trade Zone Detected: ${signals.marketState} market with ${signals.riskLevel?.toLowerCase() || "moderate"} risk. ${signalQuality.marketCleanliness || "Mixed"} conditions.`,
        signals,
        signalQuality,
      });
    }

    const direction: "rise" | "fall" = signals.bullishScore > signals.bearishScore ? "rise" : "fall";
    const confidence = Math.round(signals.confidence);
    
    // Ensure confidence is within valid range
    const finalConfidence = Math.min(100, Math.max(0, confidence));
    
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;

    const [row] = await db
      .insert(predictionsTable)
      .values({
        userId,
        symbol,
        direction,
        confidence: finalConfidence,
        entryPrice: currentPrice,
        marketState: signals.marketState,
        expiresAt,
        indicators: {
          ...indicators,
          patternName: pattern.name,
          quality: {
            cleanSignalScore: signalQuality.cleanSignalScore,
            marketCleanliness: signalQuality.marketCleanliness,
            setupRarity: signalQuality.setupRarity,
            alertType: signalQuality.alertType,
            confidenceWeight: signalQuality.confidenceWeight,
            riskScore: signalQuality.riskScore,
            indicatorAlignment: signalQuality.indicatorAlignment,
            momentumConfirmation: signalQuality.momentumConfirmation,
            volatilityCompatibility: signalQuality.volatilityCompatibility,
          },
          signals: {
            bullishScore: signals.bullishScore,
            bearishScore: signals.bearishScore,
            supportingSignals: signals.supportingSignals,
            conflictingSignals: signals.conflictingSignals,
          },
        },
      })
      .returning();

    logger.info({ 
      userId, 
      symbol, 
      direction, 
      confidence: finalConfidence,
      entryPrice: currentPrice,
      marketState: signals.marketState,
      cleanSignalScore: signalQuality.cleanSignalScore,
      predictionId: row.id 
    }, "Auto prediction generated successfully");

    return res.status(201).json({
      generated: true,
      reason: `✓ ${direction.toUpperCase()} prediction generated with ${finalConfidence}% confidence based on ${signalQuality.marketCleanliness} market conditions.`,
      prediction: formatPrediction(row),
      signalQuality,
    });
  } catch (err: any) {
    // Handle duplicate key error gracefully
    if (err.code === "23505") {
      const [existing] = await db
        .select()
        .from(predictionsTable)
        .where(
          and(
            eq(predictionsTable.userId, userId),
            eq(predictionsTable.symbol, symbol),
            isNull(predictionsTable.outcome)
          )
        )
        .limit(1);

      return res.status(409).json({
        generated: false,
        duplicate: true,
        reason: "Active prediction exists. Please resolve it first.",
        prediction: existing ? formatPrediction(existing) : null,
      });
    }

    req.log.error({ err, userId, symbol }, "Auto prediction failed");
    return res.status(500).json({ 
      generated: false, 
      reason: "Failed to generate prediction. Please try again." 
    });
  }
});

export default router;