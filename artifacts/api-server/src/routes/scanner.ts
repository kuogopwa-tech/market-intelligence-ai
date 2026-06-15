import { Router } from "express";
import { db } from "@workspace/db";
import { learningMemoryTable, symbolTimelineTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { SUPPORTED_SYMBOLS, getCandles } from "../lib/derivWs.js";
import { calculateAllIndicators } from "../lib/indicators.js";
import { mergeSignals, computeSignalQuality } from "../lib/signalEngine.js";
import { classifyIndicatorPattern, computePatternStats } from "../lib/patternEngine.js";
import { runBackgroundScan, getSchedulerStatus, isSystemReset } from "../lib/backgroundScanner.js";

const router: Router = Router();

const PRIORITY_ORDER = [
  "Elite Opportunity",
  "High Confidence",
  "Moderate Setup",
  "Watchlist Only",
  "Dangerous",
  "Avoid Market",
];

function classifyPriority(
  noTradeZone: boolean,
  cleanSignalScore: number,
  confidenceWeight: number,
  riskScore: number,
  marketState: string,
  conflictsLen: number
): string {
  if (
    !noTradeZone &&
    cleanSignalScore >= 78 &&
    confidenceWeight >= 68 &&
    conflictsLen <= 1
  ) {
    return "Elite Opportunity";
  }
  if (!noTradeZone && cleanSignalScore >= 65 && confidenceWeight >= 60) {
    return "High Confidence";
  }
  if (!noTradeZone && cleanSignalScore >= 50) {
    return "Moderate Setup";
  }
  if (riskScore >= 72 || marketState === "Spike Risk") {
    return "Dangerous";
  }
  if (noTradeZone || cleanSignalScore < 30) {
    return "Avoid Market";
  }
  return "Watchlist Only";
}

router.get("/scanner/scan", async (req, res) => {
  const granularity = parseInt(String(req.query.granularity ?? "60"), 10);

  try {
    // Load all learning memory once â€” filter per-symbol in memory
    const allMemory = await db
      .select()
      .from(learningMemoryTable)
      .orderBy(desc(learningMemoryTable.createdAt))
      .limit(600);

    const memoryBySymbol = new Map<string, typeof allMemory>();
    for (const row of allMemory) {
      if (!memoryBySymbol.has(row.symbol)) memoryBySymbol.set(row.symbol, []);
      memoryBySymbol.get(row.symbol)!.push(row);
    }

    // Scan all symbols in parallel
    type ScanResult = {
      symbol: string; displayName: string; market: string;
      bullishScore: number; bearishScore: number; confidence: number;
      marketState: string; riskLevel: string; noTradeZone: boolean;
      supportingSignals: string[]; conflictingSignals: string[];
      cleanSignalScore: number; riskScore: number; confidenceWeight: number;
      indicatorAlignment: number; momentumConfirmation: number; volatilityCompatibility: number;
      marketCleanliness: string; setupRarity: string; alertType: string;
      expirySeconds: number; historicalBoost: number;
      patternName: string; historicalSuccessRate: number; historicalTrades: number;
      priorityLevel: string;
      // Direction lock output (EMA-only) - one symbol = one final direction
      finalDirection: string;
    };

    const scanTasks: Promise<ScanResult | null>[] = SUPPORTED_SYMBOLS.map(async (sym) => {
      try {
        const candles = await getCandles(sym.symbol, granularity, 200);
        if (candles.length < 20) return null;

        const indicators = calculateAllIndicators(sym.symbol, candles);
        const signals = mergeSignals(indicators);
        const pattern = classifyIndicatorPattern(indicators);

        const symMemory = (memoryBySymbol.get(sym.symbol) ?? []).map((r) => ({
          patternType: r.patternType,
          outcome: r.outcome,
          accuracy: r.accuracy,
          patternData: r.patternData,
          symbol: r.symbol,
        }));

        const patternStats = computePatternStats(symMemory);
        const currentPatternStat = patternStats.find(
          (s) => s.pattern === pattern.name
        );

        const quality = computeSignalQuality(
          signals,
          indicators,
          currentPatternStat
            ? {
                successRate: currentPatternStat.successRate,
                totalTrades: currentPatternStat.totalTrades,
              }
            : undefined
        );

        const priorityLevel = classifyPriority(
          signals.noTradeZone,
          quality.cleanSignalScore,
          quality.confidenceWeight,
          quality.riskScore,
          signals.marketState,
          signals.conflictingSignals.length
        );

        return {
          symbol: sym.symbol,
          displayName: sym.displayName,
          market: sym.market,
          // Direction lock output (EMA-only) - one symbol = one final direction
          finalDirection: signals.finalDirection,
          // Signal fields (diagnostics only)
          bullishScore: signals.bullishScore,
          bearishScore: signals.bearishScore,
          confidence: signals.confidence,
          marketState: signals.marketState,
          riskLevel: signals.riskLevel,
          noTradeZone: signals.noTradeZone,
          supportingSignals: signals.supportingSignals,
          conflictingSignals: signals.conflictingSignals,
          // Quality fields
          cleanSignalScore: quality.cleanSignalScore,
          riskScore: quality.riskScore,
          confidenceWeight: quality.confidenceWeight,
          indicatorAlignment: quality.indicatorAlignment,
          momentumConfirmation: quality.momentumConfirmation,
          volatilityCompatibility: quality.volatilityCompatibility,
          marketCleanliness: quality.marketCleanliness,
          setupRarity: quality.setupRarity,
          alertType: quality.alertType,
          expirySeconds: quality.expirySeconds,
          historicalBoost: quality.historicalBoost,
          // Pattern
          patternName: pattern.name,
          historicalSuccessRate: currentPatternStat?.successRate ?? 0,
          historicalTrades: currentPatternStat?.totalTrades ?? 0,
          // Ranking
          priorityLevel,
        };
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(scanTasks);
    const validResults: ScanResult[] = settled
      .filter(
        (r): r is PromiseFulfilledResult<ScanResult> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    // Sort by priority tier, then by cleanSignalScore desc within tier
    validResults.sort((a, b) => {
      const ai = PRIORITY_ORDER.indexOf(a.priorityLevel);
      const bi = PRIORITY_ORDER.indexOf(b.priorityLevel);
      if (ai !== bi) return ai - bi;
      return b.cleanSignalScore - a.cleanSignalScore;
    });

    const nonDangerous = validResults.filter(
      (r) => r.priorityLevel !== "Dangerous" && r.priorityLevel !== "Avoid Market"
    );

    const topOpportunity = nonDangerous[0] ?? null;

    // EMA HARD LOCK BUCKETING:
    // - bestBullish and bestBearish are derived ONLY from finalDirection.
    // - This guarantees a symbol can never appear in both lists simultaneously.
    const bestBullish =
      [...nonDangerous]
        .filter((r) => r.finalDirection === "Bullish")
        .sort((a, b) => b.cleanSignalScore - a.cleanSignalScore)[0] ?? null;

    const bestBearish =
      [...nonDangerous]
        .filter((r) => r.finalDirection === "Bearish")
        .sort((a, b) => b.cleanSignalScore - a.cleanSignalScore)[0] ?? null;
    const cleanest =
      [...validResults]
        .filter((r) => r.marketCleanliness === "clean" || r.marketCleanliness === "trending")
        .sort((a, b) => b.volatilityCompatibility - a.volatilityCompatibility)[0] ?? null;
    const safest =
      [...nonDangerous].sort((a, b) => a.riskScore - b.riskScore)[0] ?? null;
    const mostDangerous =
      [...validResults].sort((a, b) => b.riskScore - a.riskScore)[0] ?? null;

    res.json({
      scannedAt: Math.floor(Date.now() / 1000),
      totalSymbols: validResults.length,
      eliteCount: validResults.filter((r) => r.priorityLevel === "Elite Opportunity").length,
      highConfidenceCount: validResults.filter((r) => r.priorityLevel === "High Confidence").length,
      results: validResults,
      topOpportunity,
      bestBullish,
      bestBearish,
      cleanest,
      safest,
      mostDangerous,
    });

    // Save timeline snapshots in background â€” non-blocking
    void (async () => {
      try {
        const now = new Date();
        const hour = now.getUTCHours();
        const dayOfWeek = now.getUTCDay();
        await db.insert(symbolTimelineTable).values(
          validResults.map((r) => ({
            symbol: r.symbol,
            snapshotAt: now,
            hour,
            dayOfWeek,
            cleanSignalScore: Math.round(r.cleanSignalScore),
            riskScore: Math.round(r.riskScore),
            confidence: Math.round(r.confidence),
            marketState: r.marketState,
            riskLevel: r.riskLevel,
            volatilityCompatibility: Math.round(r.volatilityCompatibility),
            indicatorAlignment: Math.round(r.indicatorAlignment),
            momentumConfirmation: Math.round(r.momentumConfirmation),
            alertType: r.alertType,
            priorityLevel: r.priorityLevel,
            marketCleanliness: r.marketCleanliness,
            setupRarity: r.setupRarity,
            bullishScore: Math.round(r.bullishScore),
            bearishScore: Math.round(r.bearishScore),
            noTradeZone: r.noTradeZone,
            patternName: r.patternName,
          }))
        );
      } catch {
        // Non-critical â€” never block the response
      }
    })();
  } catch (err) {
    req.log.error({ err }, "Scanner scan failed");
    res.status(500).json({ error: "Scanner failed" });
  }
});

router.post("/scanner/cron", async (req, res) => {
  // Simple auth check for Vercel Cron
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check if system reset is active - skip cron scan if reset was requested
  const resetState = isSystemReset();
  if (resetState.active) {
    req.log.info({ resetState }, "Cron scan skipped - system reset in progress");
    res.json({ success: false, error: "System reset in progress", status: getSchedulerStatus() });
    return;
  }

  try {
    // We don't await this to avoid Vercel timeout if the scan takes too long, 
    // but Vercel functions terminate when the response is sent.
    // So for serverless, we might actually need to await it or use a different strategy.
    // However, if we await it, we must ensure it stays under the limit (usually 10s-60s).
    await runBackgroundScan();
    res.json({ success: true, status: getSchedulerStatus() });
  } catch (err) {
    req.log.error({ err }, "Cron scan failed");
    res.status(500).json({ error: "Cron scan failed" });
  }
});

export default router;
