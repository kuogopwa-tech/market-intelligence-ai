import { db, checkDbConnection } from "@workspace/db";
import {
  learningMemoryTable,
  symbolTimelineTable,
  intelligenceSnapshotsTable,
  scanRunsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { SUPPORTED_SYMBOLS, getCandles } from "./derivWs.js.js";
import { calculateAllIndicators } from "./indicators.js.js";
import { mergeSignals, computeSignalQuality } from "./signalEngine.js.js";
import { classifyIndicatorPattern, computePatternStats } from "./patternEngine.js.js";
import { runAggregation } from "./aggregationEngine.js.js";
import { detectEvolution } from "./evolutionEngine.js.js";
import { refreshSymbolPersonality } from "./personalityRefresher.js.js";
import { logger } from "./logger.js.js";

const SCAN_INTERVAL_MS = parseInt(
  process.env["SCAN_INTERVAL_MS"] ?? "300000",
  10
);
const MAX_HEAP_MB = parseInt(process.env["MAX_HEAP_MB"] ?? "400", 10);

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
  ) return "Elite Opportunity";
  if (!noTradeZone && cleanSignalScore >= 65 && confidenceWeight >= 60)
    return "High Confidence";
  if (!noTradeZone && cleanSignalScore >= 50) return "Moderate Setup";
  if (riskScore >= 72 || marketState === "Spike Risk") return "Dangerous";
  if (noTradeZone || cleanSignalScore < 30) return "Avoid Market";
  return "Watchlist Only";
}

// â”€â”€ Shared scan logic (also used by the scanner route) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type SymbolScanResult = {
  symbol: string;
  displayName: string;
  market: string;
  bullishScore: number;
  bearishScore: number;
  confidence: number;
  marketState: string;
  riskLevel: string;
  noTradeZone: boolean;
  supportingSignals: string[];
  conflictingSignals: string[];
  cleanSignalScore: number;
  riskScore: number;
  confidenceWeight: number;
  indicatorAlignment: number;
  momentumConfirmation: number;
  volatilityCompatibility: number;
  marketCleanliness: string;
  setupRarity: string;
  alertType: string;
  expirySeconds: number;
  historicalBoost: number;
  patternName: string;
  historicalSuccessRate: number;
  historicalTrades: number;
  priorityLevel: string;
};

export async function scanSymbol(
  sym: { symbol: string; displayName: string; market: string },
  granularity: number,
  memoryRows: Array<{
    patternType: string;
    outcome: string;
    accuracy: number | null;
    patternData: unknown;
    symbol: string;
  }>
): Promise<SymbolScanResult | null> {
  try {
    const candles = await getCandles(sym.symbol, granularity, 200);
    if (candles.length < 20) return null;

    const indicators = calculateAllIndicators(sym.symbol, candles);
    const signals = mergeSignals(indicators);
    const pattern = classifyIndicatorPattern(indicators);
    const patternStats = computePatternStats(memoryRows);
    const currentPatternStat = patternStats.find((s) => s.pattern === pattern.name);

    const quality = computeSignalQuality(
      signals,
      indicators,
      currentPatternStat
        ? { successRate: currentPatternStat.successRate, totalTrades: currentPatternStat.totalTrades }
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
      bullishScore: signals.bullishScore,
      bearishScore: signals.bearishScore,
      confidence: signals.confidence,
      marketState: signals.marketState,
      riskLevel: signals.riskLevel,
      noTradeZone: signals.noTradeZone,
      supportingSignals: signals.supportingSignals,
      conflictingSignals: signals.conflictingSignals,
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
      patternName: pattern.name,
      historicalSuccessRate: currentPatternStat?.successRate ?? 0,
      historicalTrades: currentPatternStat?.totalTrades ?? 0,
      priorityLevel,
    };
  } catch {
    return null;
  }
}

// â”€â”€ Scheduler state (in-memory) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SchedulerState {
  running: boolean;
  lastScanAt: number | null;
  nextScanAt: number | null;
  totalScans: number;
  startedAt: number;
  lastLatencyMs: number | null;
  lastError: string | null;
  currentScanRunId: number | null;
}

const state: SchedulerState = {
  running: false,
  lastScanAt: null,
  nextScanAt: null,
  totalScans: 0,
  startedAt: Date.now(),
  lastLatencyMs: null,
  lastError: null,
  currentScanRunId: null,
};

let scanLock = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function getSchedulerStatus() {
  return {
    ...state,
    isScanning: scanLock,
    intervalMs: SCAN_INTERVAL_MS,
  };
}

// â”€â”€ Full background scan run â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function runBackgroundScan(): Promise<void> {
  if (scanLock) {
    logger.warn("Background scan skipped â€” previous scan still running");
    return;
  }

  // Double check DB connection before starting.
  // If DB is offline, we skip the scan to avoid spamming connection errors.
  const isDbOnline = await checkDbConnection();
  if (!isDbOnline) {
    logger.warn("Background scan skipped â€” Database is DISCONNECTED");
    state.lastError = "Database disconnected";
    state.nextScanAt = Date.now() + SCAN_INTERVAL_MS;
    return;
  }

  // Set lock BEFORE any async work. The outer try/finally unconditionally
  // clears it so a DB hiccup on the initial insert cannot permanently deadlock.
  scanLock = true;
  const startTime = Date.now();
  let scanRunId: number | null = null;
  let succeeded = 0;
  let failed = 0;

  try {
    // Insert scan_run record â€” inside try so failures are caught and lock released.
    const [runRow] = await db
      .insert(scanRunsTable)
      .values({ triggeredBy: "scheduler" })
      .returning();
    scanRunId = runRow.id;
    state.currentScanRunId = scanRunId;

    const heapMb = process.memoryUsage().heapUsed / 1024 / 1024;
    const skipAnalytics = heapMb > MAX_HEAP_MB;
    if (skipAnalytics) {
      logger.warn({ heapMb }, "Heap usage high â€” skipping analytics refresh this cycle");
    }

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

    const results: SymbolScanResult[] = [];
    const now = new Date();
    const hour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();

    // Scan all symbols with exponential-backoff retry (max 3 attempts per symbol)
    for (const sym of SUPPORTED_SYMBOLS) {
      let result: SymbolScanResult | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        result = await scanSymbol(sym, 60, memoryBySymbol.get(sym.symbol) ?? []);
        if (result !== null) break;
        if (attempt < 2) {
          const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      if (result) {
        results.push(result);
        succeeded++;
      } else {
        failed++;
      }
    }

    if (results.length > 0) {
      // Batch-write intelligence snapshots + symbol timeline in one transaction
      const runIdForInsert = scanRunId; // satisfies strict null checks in closure
      await db.transaction(async (tx) => {
        await tx.insert(intelligenceSnapshotsTable).values(
          results.map((r) => ({
            scanRunId: runIdForInsert,
            symbol: r.symbol,
            snapshotAt: now,
            hour,
            dayOfWeek,
            cleanSignalScore: Math.round(r.cleanSignalScore),
            riskScore: Math.round(r.riskScore),
            confidence: Math.round(r.confidence),
            marketState: r.marketState,
            riskLevel: r.riskLevel,
            priorityLevel: r.priorityLevel,
            alertType: r.alertType,
            marketCleanliness: r.marketCleanliness,
            setupRarity: r.setupRarity,
            volatilityCompatibility: Math.round(r.volatilityCompatibility),
            indicatorAlignment: Math.round(r.indicatorAlignment),
            momentumConfirmation: Math.round(r.momentumConfirmation),
            bullishScore: Math.round(r.bullishScore),
            bearishScore: Math.round(r.bearishScore),
            noTradeZone: r.noTradeZone,
            patternName: r.patternName,
          }))
        );

        await tx.insert(symbolTimelineTable).values(
          results.map((r) => ({
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
      });

      if (!skipAnalytics) {
        const sid = scanRunId;
        // Refresh behavioral personality from historical intelligence_snapshots (non-blocking)
        void Promise.allSettled(
          results.map((r) => refreshSymbolPersonality(r.symbol, sid))
        ).then((outcomes) => {
          const failCount = outcomes.filter((o) => o.status === "rejected").length;
          if (failCount > 0) logger.warn({ failCount }, "Some personality refreshes failed");
        });

        // Run aggregation + evolution detection in background (non-blocking to scan run)
        void runAggregation(results, now).catch((err) =>
          logger.error({ err }, "Aggregation engine error")
        );
        void detectEvolution().catch((err) =>
          logger.error({ err }, "Evolution engine error")
        );
      }
    }

    const durationMs = Date.now() - startTime;
    if (scanRunId !== null) {
      await db
        .update(scanRunsTable)
        .set({
          completedAt: new Date(),
          durationMs,
          symbolsScanned: SUPPORTED_SYMBOLS.length,
          symbolsSucceeded: succeeded,
          symbolsFailed: failed,
        })
        .where(eq(scanRunsTable.id, scanRunId));
    }

    state.lastScanAt = Date.now();
    state.lastLatencyMs = durationMs;
    state.totalScans++;
    state.lastError = null;

    logger.info(
      { durationMs, succeeded, failed, scanRunId },
      "Background scan completed"
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    state.lastError = errMsg;
    logger.error({ err, scanRunId }, "Background scan failed");

    if (scanRunId !== null) {
      await db
        .update(scanRunsTable)
        .set({
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          symbolsScanned: SUPPORTED_SYMBOLS.length,
          symbolsSucceeded: succeeded,
          symbolsFailed: SUPPORTED_SYMBOLS.length - succeeded,
          error: errMsg,
        })
        .where(eq(scanRunsTable.id, scanRunId))
        .catch(() => {});
    }
  } finally {
    // Always release lock â€” even if the initial scan_run insert failed.
    scanLock = false;
    state.currentScanRunId = null;
  }
}

// â”€â”€ Public: start / stop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function startBackgroundScanner(): void {
  if (intervalHandle !== null) return;

  state.running = true;
  state.startedAt = Date.now();
  state.nextScanAt = Date.now() + SCAN_INTERVAL_MS;

  logger.info({ intervalMs: SCAN_INTERVAL_MS }, "Background scanner started");

  // Run first scan after a short delay so server finishes booting
  const initialDelay = 10_000;
  setTimeout(() => {
    state.nextScanAt = Date.now();
    void runBackgroundScan().finally(() => {
      state.nextScanAt = Date.now() + SCAN_INTERVAL_MS;
    });
  }, initialDelay);

  intervalHandle = setInterval(() => {
    state.nextScanAt = Date.now() + SCAN_INTERVAL_MS;
    void runBackgroundScan();
  }, SCAN_INTERVAL_MS);

  process.on("SIGTERM", stopBackgroundScanner);
  process.on("SIGINT", stopBackgroundScanner);
}

export function stopBackgroundScanner(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  state.running = false;
  logger.info("Background scanner stopped");
}

