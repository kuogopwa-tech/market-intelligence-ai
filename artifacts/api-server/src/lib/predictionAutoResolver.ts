import { db } from "@workspace/db";
import { predictionsTable, learningMemoryTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getCandles } from "../lib/derivWs.js";
import { calculateAllIndicators } from "../lib/indicators.js";
import { logger } from "../lib/logger.js";
import type { InferInsertModel } from "drizzle-orm";
import { isSystemReset } from "./backgroundScanner.js";

function intervalToSeconds(interval: string): number | null {
  const normalized = interval.trim().toLowerCase();

  const asNumber = (n: number) =>
    Number.isFinite(n) && n > 0 ? n : null;

  if (normalized === "1m") return 60;
  if (normalized === "5m") return asNumber(5 * 60);
  if (normalized === "15m") return asNumber(15 * 60);
  if (normalized === "1h") return asNumber(60 * 60);
  if (normalized === "4h") return asNumber(4 * 60 * 60);
  if (normalized === "1d") return asNumber(24 * 60 * 60);

  return null;
}

function resolveCloseAtWindowEndEpoch(
  candles: Awaited<ReturnType<typeof getCandles>>,
  windowEndEpochMs: number
) {
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

export type RunAutoResolveExpiredPredictionsOptions = {
  limit?: number;
  symbol?: string;
  userId?: string;
};

export async function runAutoResolveExpiredPredictions(
  options: RunAutoResolveExpiredPredictionsOptions = {}
): Promise<{
  resolvedCount: number;
  correctCount: number;
  incorrectCount: number;
  learningMemoryInserted: number;
}> {
  const resetState = isSystemReset();
  if (resetState.active) {
    logger.warn(
      { resetSymbol: resetState.symbol, options },
      "Auto-resolve skipped — system reset in progress"
    );
    return {
      resolvedCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      learningMemoryInserted: 0,
    };
  }

  const limit = options.limit ?? 500;
  const nowS = Math.floor(Date.now() / 1000);

  // DB filter: outcome is still NULL, and resolveAt has elapsed (resolveAt <= now)
  // NOTE: resolveAt must be non-null for evaluation.
  const pending = await db
    .select()
    .from(predictionsTable)
    .where(
      and(
        isNull(predictionsTable.outcome),

        options.userId
          ? eq(predictionsTable.userId, options.userId)
          : undefined,

        options.symbol
          ? eq(predictionsTable.symbol, options.symbol)
          : undefined,

        sql`${(predictionsTable as any).resolveAt ?? (predictionsTable as any).resolve_at} IS NOT NULL`,
        sql`${(predictionsTable as any).resolveAt ?? (predictionsTable as any).resolve_at} <= ${nowS}`
      )
    )
    .orderBy(desc(predictionsTable.createdAt))
    .limit(limit);

  const candidates = pending;

  let correctCount = 0;
  let incorrectCount = 0;
  let learningMemoryInserted = 0;

  // Candle cache: key = `${symbol}|${intervalSeconds}`
  const candlesCache = new Map<
    string,
    Awaited<ReturnType<typeof getCandles>>
  >();

  let resolvedCount = 0;

  for (const pred of candidates) {
    const windowEndS =
      (pred as any).resolveAt ??
      (pred as any).resolve_at ??
      pred.expiresAt ??
      null;
    if (!windowEndS) continue;
    if (nowS < windowEndS) continue;

    const intervalSeconds = intervalToSeconds(pred.interval);
    if (!intervalSeconds) continue;

    const cacheKey = `${pred.symbol}|${intervalSeconds}`;
    let candles = candlesCache.get(cacheKey);
    if (!candles) {
      candles = await getCandles(pred.symbol, intervalSeconds, 200);
      candlesCache.set(cacheKey, candles);
    }
    if (!candles || candles.length < 1) continue;

    const closeCandle = resolveCloseAtWindowEndEpoch(
      candles,
      windowEndS * 1000
    );
    if (!closeCandle) continue;

    const closeAtWindowEnd = closeCandle.close;

    let outcome: "correct" | "incorrect";
    if (pred.direction === "rise") {
      outcome = closeAtWindowEnd > pred.entryPrice ? "correct" : "incorrect";
    } else if (pred.direction === "fall") {
      outcome = closeAtWindowEnd < pred.entryPrice ? "correct" : "incorrect";
    } else {
      continue;
    }

    // Duplicate protection: only resolve if still pending (outcome IS NULL)
    const updated = await db
      .update(predictionsTable)
      .set({
        outcome,
        status: outcome,
        exitPrice: closeAtWindowEnd,
        resolvedAt: nowS,
      })
      .where(
        and(eq(predictionsTable.id, pred.id), isNull(predictionsTable.outcome))
      )
      .returning();

    if (!updated || updated.length === 0) {
      // Someone else resolved it first
      continue;
    }

    resolvedCount++;

    if (outcome === "correct") correctCount++;
    else incorrectCount++;

    const resolvedRow = updated[0];

    // Insert learning_memory. This insert is tied to successful prediction update,
    // preventing duplicates as long as the update is atomic.
    await db.insert(learningMemoryTable).values({
      userId: resolvedRow.userId,
      symbol: resolvedRow.symbol,
      patternType:
        (resolvedRow.indicators as any)?.patternName ?? "prediction_outcome",
      patternData: {
        direction: resolvedRow.direction,
        confidence: resolvedRow.confidence,
        marketState: resolvedRow.marketState,
        indicators: resolvedRow.indicators,
      },
      outcome,
      accuracy:
        outcome === "correct"
          ? resolvedRow.confidence
          : 100 - resolvedRow.confidence,
    });

    learningMemoryInserted++;
  }

  logger.info(
    {
      resolvedCount,
      correctCount,
      incorrectCount,
      learningMemoryInserted,
      options,
    },
    "Auto-resolve expired predictions completed"
  );

  return {
    resolvedCount,
    correctCount,
    incorrectCount,
    learningMemoryInserted,
  };
}
