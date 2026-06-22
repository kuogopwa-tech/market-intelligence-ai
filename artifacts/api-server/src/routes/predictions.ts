﻿import { Router } from "express";
import { db } from "@workspace/db";
import { predictionsTable, learningMemoryTable } from "@workspace/db";
import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { CreatePredictionBody, UpdatePredictionOutcomeBody, UpdatePredictionOutcomeParams } from "@workspace/api-zod";
import { getCandles } from "../lib/derivWs.js";
import { calculateAllIndicators } from "../lib/indicators.js";
import { mergeSignals, computeSignalQuality } from "../lib/signalEngine.js";
import { classifyIndicatorPattern } from "../lib/patternEngine.js";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

const router: Router = Router();

const PREDICTION_COOLDOWN_MS = 30000; // 30 seconds cooldown

// Production timing window (seconds)
// Prefer env override on server, fallback to 30s per requirements.
const PREDICTION_WINDOW_SECONDS =
  process.env.PREDICTION_WINDOW_SECONDS
    ? Math.max(1, parseInt(process.env.PREDICTION_WINDOW_SECONDS, 10))
    : 30;

function secondsRemainingFromResolveAt(resolveAtS: number, nowMs = Date.now()): number {
  const remainingMs = resolveAtS * 1000 - nowMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function intervalToSeconds(interval: string): number | null {
  const normalized = interval.trim().toLowerCase();

  const asNumber = (n: number) =>
    Number.isFinite(n) && n > 0 ? n : null;

  // Supported values from the UI/store:
  // "1m","5m","15m","1h","4h","1d"
  if (normalized === "1m") return 60;
  if (normalized === "5m") return asNumber(5 * 60);
  if (normalized === "15m") return asNumber(15 * 60);
  if (normalized === "1h") return asNumber(60 * 60);
  if (normalized === "4h") return asNumber(4 * 60 * 60);
  if (normalized === "1d") return asNumber(24 * 60 * 60);

  return null;
}

function resolveCloseAtWindowEndEpoch(candles: Awaited<ReturnType<typeof getCandles>>, windowEndEpochMs: number) {
  // candles are returned with epoch values in seconds (see derivWs candle interface: epoch:number)
  // Pick the last candle with epoch <= windowEndTime.
  let last: (typeof candles)[number] | null = null;
  const windowEndEpochS = Math.floor(windowEndEpochMs / 1000);

  for (const c of candles) {
    if (c.epoch <= windowEndEpochS) last = c;
    else break;
  }
  return last;
}

/**
 * Rate limiting storage (userId -> symbol -> lastPredictionTimestamp)
 * NOTE: This is in-memory and must be cleared during system reset to avoid
 * post-reset prediction throttling “ghost state”.
 */
const lastPredictionTimes = new Map<string, Map<string, number>>();

export function clearPredictionRateLimits(): void {
  lastPredictionTimes.clear();
}

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
  const nowMs = Date.now();

  const resolveAtS: number | null =
    // New timing field
    (r as any).resolveAt ?? // drizzle may map bigint columns to number
    (r as any).resolve_at ?? // fallback if column name maps
    null;

  const status: "pending" | "correct" | "incorrect" =
    (r as any).status ??
    (r.outcome === "correct" ? "correct" : r.outcome === "incorrect" ? "incorrect" : "pending");

  const secondsRemaining =
    typeof resolveAtS === "number" && Number.isFinite(resolveAtS)
      ? secondsRemainingFromResolveAt(resolveAtS, nowMs)
      : null;

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

    // Required by production-ready timing spec
    resolveAt: resolveAtS,
    status,
    secondsRemaining,

    createdAt: Math.floor(r.createdAt.getTime() / 1000),
  };
}

/* -------------------------------------------------------
   CORE EVALUATION (WRITE ONLY - NO GET ROUTES CALL IT)
------------------------------------------------------- */

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
  console.log("ACCURACY ROUTE HIT", req.originalUrl);
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

/**
 * GET SINGLE PREDICTION WITH PRECISE RESOLUTION TIMING
 * - If now < resolveAt => pending + secondsRemaining
 * - If now >= resolveAt => evaluate outcome, update status/outcome/resolvedAt, return final
 */
router.get("/predictions/:id", requireAuth(), async (req, res) => {
  console.log("ID ROUTE HIT", req.originalUrl, req.params.id);
  const userId = req.user!.id;
  const id = parseInt(String(req.params.id), 10);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid prediction id" });
  }

  try {
    const pred = await db
      .select()
      .from(predictionsTable)
      .where(and(eq(predictionsTable.id, id), eq(predictionsTable.userId, userId)))
      .limit(1);

    const row = pred[0];
    if (!row) return res.status(404).json({ error: "Prediction not found" });

    const nowS = Math.floor(Date.now() / 1000);
    const resolveAtS =
      (row as any).resolveAt ?? (row as any).resolve_at ?? null;

    // Not resolved yet
    if (typeof resolveAtS === "number" && nowS < resolveAtS) {
      return res.json({
        ...formatPrediction(row),
        status: "pending",
      });
    }

    // Already resolved in DB
    if (row.outcome === "correct") {
      return res.json({
        ...formatPrediction(row),
        status: "correct",
      });
    }
    if (row.outcome === "incorrect") {
      return res.json({
        ...formatPrediction(row),
        status: "incorrect",
      });
    }

    // Evaluate now (server time)
    const expiresOrResolveEndEpochS = typeof resolveAtS === "number" ? resolveAtS : null;
    if (!expiresOrResolveEndEpochS) {
      return res.status(500).json({ error: "Prediction resolveAt missing" });
    }

    // Fetch candles for the symbol to pick close at resolveAt window end
    const intervalSeconds = intervalToSeconds(row.interval) ?? 60;
    const candles = await getCandles(row.symbol, intervalSeconds, 200);
    const closeCandle = resolveCloseAtWindowEndEpoch(candles, expiresOrResolveEndEpochS * 1000);

    if (!closeCandle) {
      return res.status(503).json({ error: "Insufficient market data to resolve prediction" });
    }

    const closeAtResolveEnd = closeCandle.close;

    let outcome: "correct" | "incorrect";
    if (row.direction === "rise") outcome = closeAtResolveEnd > row.entryPrice ? "correct" : "incorrect";
    else if (row.direction === "fall") outcome = closeAtResolveEnd < row.entryPrice ? "correct" : "incorrect";
    else return res.status(400).json({ error: "Invalid prediction direction" });

    // Atomic update (only if still pending/outcome null)
    const updated = await db
      .update(predictionsTable)
      .set({
        outcome,
        status: outcome,
        exitPrice: closeAtResolveEnd,
        resolvedAt: nowS,
      })
      .where(and(eq(predictionsTable.id, id), eq(predictionsTable.userId, userId), isNull(predictionsTable.outcome)))
      .returning();

    const updatedRow = updated[0] ?? row;

    // Insert learning_memory for resolved predictions
    await db.insert(learningMemoryTable).values({
      userId: updatedRow.userId,
      symbol: updatedRow.symbol,
      patternType: (updatedRow.indicators as any)?.patternName ?? "prediction_outcome",
      patternData: {
        direction: updatedRow.direction,
        confidence: updatedRow.confidence,
        marketState: updatedRow.marketState,
        indicators: updatedRow.indicators,
      },
      outcome,
      accuracy: outcome === "correct" ? updatedRow.confidence : 100 - updatedRow.confidence,
    });

    return res.json({
      ...formatPrediction(updatedRow),
      status: outcome,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve prediction");
    return res.status(500).json({ error: "Failed to fetch prediction" });
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
  const rawInterval = String((req.body as any)?.interval ?? "1m");
  const intervalSeconds = intervalToSeconds(rawInterval);
  const safeIntervalSeconds = intervalSeconds ?? 60;
  const createdAtS = Math.floor(Date.now() / 1000);

  // Required: resolveAt = server time + PREDICTION_WINDOW_SECONDS (configurable)
  const resolveAtS = createdAtS + PREDICTION_WINDOW_SECONDS;

  // Legacy expiresAt kept for backwards compatibility / auto-resolver
  const expiresAt = createdAtS + safeIntervalSeconds;

  try {
    // Concurrency is enforced ONLY by PostgreSQL partial unique index.
    // Do not SELECT-lock / check for existing pending prediction here.

    const [row] = await db
      .insert(predictionsTable)
      .values({
        userId,
        symbol,
        interval: rawInterval,
        direction,
        confidence,
        entryPrice,
        analysisId: analysisId ?? null,

        expiresAt,
        // New fields
        resolveAt: resolveAtS,
        status: "pending",

        indicators: indicators as Record<string, unknown>,
      })
      .returning();

    return res.status(201).json(formatPrediction(row));
  } catch (err: any) {
    if (err.code === "23505") {
      // Unique index conflict => an active prediction already exists.
      return res.status(409).json({
        generated: false,
        duplicate: true,
        reason: "Active prediction exists",
        prediction: null,
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
  const rawSymbol = String((req.body as any)?.symbol ?? "R_100");
  const rawInterval = String((req.body as any)?.interval ?? "1m");

  const intervalSeconds = intervalToSeconds(rawInterval) ?? 60;

  const symbol = rawSymbol;

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
    // We fetch candles for the generation logic. Evaluation later is based on the stored resolveAt window.
    const candles = await getCandles(symbol, 60, 200);
    if (candles.length < 20) {
      return res.status(503).json({
        generated: false,
        reason: "Insufficient market data. Please try again in a few seconds.",
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
        reason: `⚠️ No-Trade Zone Detected: ${signals.marketState} market with ${signals.riskLevel?.toLowerCase() || "moderate"} risk. ${
          signalQuality.marketCleanliness || "Mixed"
        } conditions.`,
        signals,
        signalQuality,
      });
    }

    const direction: "rise" | "fall" =
      signals.bullishScore > signals.bearishScore ? "rise" : "fall";
    const confidence = Math.round(signals.confidence);

    // Ensure confidence is within valid range
    const finalConfidence = Math.min(100, Math.max(0, confidence));

    const createdAtS = Math.floor(Date.now() / 1000);

    // Legacy window (expiresAt) and required production window (resolveAt)
    const expiresAt = createdAtS + intervalSeconds;
    const resolveAt = createdAtS + PREDICTION_WINDOW_SECONDS;

    const [row] = await db
      .insert(predictionsTable)
      .values({
        userId,
        symbol,
        interval: rawInterval,
        direction,
        confidence: finalConfidence,
        entryPrice: currentPrice,
        marketState: signals.marketState,

        expiresAt,
        resolveAt,
        status: "pending",

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

    logger.info(
      {
        userId,
        symbol,
        direction,
        confidence: finalConfidence,
        entryPrice: currentPrice,
        marketState: signals.marketState,
        cleanSignalScore: signalQuality.cleanSignalScore,
        predictionId: row.id,
      },
      "Auto prediction generated successfully"
    );

    return res.status(201).json({
      generated: true,
      reason: `✓ ${direction.toUpperCase()} prediction generated with ${finalConfidence}% confidence based on ${signalQuality.marketCleanliness} market conditions.`,
      prediction: formatPrediction(row),
      signalQuality,
    });
  } catch (err: any) {
    // Handle duplicate key error gracefully
    if (err.code === "23505") {
      return res.status(409).json({
        generated: false,
        duplicate: true,
        reason: "Active prediction exists. Please resolve it first.",
        prediction: null,
      });
    }

    req.log.error({ err, userId, symbol }, "Auto prediction failed");
    return res.status(500).json({
      generated: false,
      reason: "Failed to generate prediction. Please try again.",
    });
  }
});

export default router;