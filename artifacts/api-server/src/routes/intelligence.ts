import { Router } from "express";
import { db } from "@workspace/db";
import {
  intelligenceSnapshotsTable,
  dailySummariesTable,
  learningMemoryTable,
  scanRunsTable,
} from "@workspace/db";
import { eq, desc, gte, asc, and, count } from "drizzle-orm";
import { getTimingModel } from "../lib/timingModel.js";
import { SUPPORTED_SYMBOLS } from "../lib/derivWs.js";

const router: Router = Router();

// â”€â”€ GET /intelligence/status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/intelligence/status", async (req, res) => {
  try {
    const scanIntervalMs = parseInt(process.env["SCAN_INTERVAL_MS"] ?? "300000", 10);

    // Get oldest snapshot to compute depth (kept as-is)
    const oldest = await db
      .select({ snapshotAt: intelligenceSnapshotsTable.snapshotAt })
      .from(intelligenceSnapshotsTable)
      .orderBy(asc(intelligenceSnapshotsTable.snapshotAt))
      .limit(1);

    const oldestAt = oldest[0]?.snapshotAt ?? null;
    const historicalDepthMs = oldestAt ? Date.now() - oldestAt.getTime() : null;
    const historicalDepthHours = historicalDepthMs ? Math.round(historicalDepthMs / 3600000) : 0;
    const historicalDepthDays = Math.floor(historicalDepthHours / 24);

    // Fetch recent scan runs (last 10)
    const recentRuns = await db
      .select()
      .from(scanRunsTable)
      .orderBy(desc(scanRunsTable.startedAt))
      .limit(10);

    // Count distinct symbols with data (kept as-is)
    const symbolsWithData = new Set<string>();
    const recentSnaps = await db
      .select({ symbol: intelligenceSnapshotsTable.symbol })
      .from(intelligenceSnapshotsTable)
      .orderBy(desc(intelligenceSnapshotsTable.snapshotAt))
      .limit(200);
    for (const s of recentSnaps) symbolsWithData.add(s.symbol);

    // Persisted totals / last run derived from scan_runs table
    const totalScans = await db
      .select({ count: count() })
      .from(scanRunsTable);

    // Drizzle/Postgres may return count as string/number/bigint depending on driver/runtime.
    // Convert deterministically without relying on Number() coercion.
    const totalScansValue = parseInt(String(totalScans[0]?.count ?? "0"), 10);

    const latestRun = await db
      .select()
      .from(scanRunsTable)
      .orderBy(desc(scanRunsTable.startedAt))
      .limit(1);

    const lastRun = latestRun[0] ?? null;

    const running = !!lastRun && lastRun.completedAt === null;
    const isScanning = running; // in serverless, in-memory locks don't persist; derive best-effort from DB row

    const lastScanAt = lastRun
      ? Math.floor(lastRun.completedAt ? lastRun.completedAt.getTime() / 1000 : lastRun.startedAt.getTime() / 1000)
      : null;

    const lastLatencyMs = lastRun?.durationMs ?? null;
    const lastError = lastRun?.error ?? null;

    const lastCompletedAtMs = lastRun?.completedAt ? lastRun.completedAt.getTime() : null;
    const lastBaseMs = lastCompletedAtMs ?? (lastRun ? lastRun.startedAt.getTime() : null);

    const nextScanAt =
      lastBaseMs != null ? Math.floor((lastBaseMs + scanIntervalMs) / 1000) : null;

    // UptimeSeconds is now derived from DB (fallback to 0 if no runs).
    // If you prefer “time since last scan started”, this matches lastBaseMs.
    const uptimeSeconds =
      lastRun?.startedAt ? Math.max(0, Math.floor((Date.now() - lastRun.startedAt.getTime()) / 1000)) : 0;

    res.json({
      running,
      isScanning,
      lastScanAt,
      nextScanAt,
      totalScans: totalScansValue,
      lastLatencyMs,
      lastError,
      intervalMs: scanIntervalMs,
      uptimeSeconds,
      historicalDepthHours,
      historicalDepthDays,
      symbolsTracked: symbolsWithData.size,
      totalSymbols: SUPPORTED_SYMBOLS.length,
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        startedAt: Math.floor(r.startedAt.getTime() / 1000),
        completedAt: r.completedAt ? Math.floor(r.completedAt.getTime() / 1000) : null,
        durationMs: r.durationMs,
        symbolsScanned: r.symbolsScanned,
        symbolsSucceeded: r.symbolsSucceeded,
        symbolsFailed: r.symbolsFailed,
        error: r.error,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Intelligence status failed");
    res.status(500).json({ error: "Intelligence status failed" });
  }
});

// â”€â”€ GET /intelligence/snapshots/:symbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/intelligence/snapshots/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "200"), 10),
      500
    );

    const rows = await db
      .select()
      .from(intelligenceSnapshotsTable)
      .where(eq(intelligenceSnapshotsTable.symbol, symbol))
      .orderBy(desc(intelligenceSnapshotsTable.snapshotAt))
      .limit(limit);

    res.json({
      symbol,
      snapshots: rows.map((r) => ({
        id: r.id,
        scanRunId: r.scanRunId,
        snapshotAt: Math.floor(r.snapshotAt.getTime() / 1000),
        hour: r.hour,
        dayOfWeek: r.dayOfWeek,
        cleanSignalScore: r.cleanSignalScore,
        riskScore: r.riskScore,
        confidence: r.confidence,
        marketState: r.marketState,
        riskLevel: r.riskLevel,
        priorityLevel: r.priorityLevel,
        alertType: r.alertType,
        marketCleanliness: r.marketCleanliness,
        setupRarity: r.setupRarity,
        volatilityCompatibility: r.volatilityCompatibility,
        indicatorAlignment: r.indicatorAlignment,
        momentumConfirmation: r.momentumConfirmation,
        bullishScore: r.bullishScore,
        bearishScore: r.bearishScore,
        noTradeZone: r.noTradeZone,
        patternName: r.patternName,
      })),
      total: rows.length,
    });
  } catch (err) {
    req.log.error({ err }, "Intelligence snapshots failed");
    res.status(500).json({ error: "Snapshots fetch failed" });
  }
});

// â”€â”€ GET /intelligence/hourly/:symbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/intelligence/hourly/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const model = await getTimingModel(symbol);
    res.json(model);
  } catch (err) {
    req.log.error({ err }, "Intelligence hourly failed");
    res.status(500).json({ error: "Hourly timing model failed" });
  }
});

// â”€â”€ GET /intelligence/daily/:symbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/intelligence/daily/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;

    const rows = await db
      .select()
      .from(dailySummariesTable)
      .where(eq(dailySummariesTable.symbol, symbol))
      .orderBy(desc(dailySummariesTable.date))
      .limit(30);

    res.json({
      symbol,
      dailySummaries: rows.map((r) => ({
        date: r.date,
        avgQuality: Math.round(r.avgQuality),
        avgConfidence: Math.round(r.avgConfidence),
        avgRisk: Math.round(r.avgRisk),
        sampleCount: r.sampleCount,
        eliteCount: r.eliteCount,
        dangerousCount: r.dangerousCount,
        peakQualityHour: r.peakQualityHour,
        worstQualityHour: r.worstQualityHour,
        dominantState: r.dominantState,
        dominantPersonality: r.dominantPersonality,
      })),
      total: rows.length,
    });
  } catch (err) {
    req.log.error({ err }, "Intelligence daily failed");
    res.status(500).json({ error: "Daily summary fetch failed" });
  }
});

// â”€â”€ GET /intelligence/evolution/:symbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/intelligence/evolution/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = Math.min(
      parseInt(String(req.query.limit ?? "50"), 10),
      200
    );

    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);

    const rows = await db
      .select()
      .from(learningMemoryTable)
      .where(
        and(
          eq(learningMemoryTable.symbol, symbol),
          eq(learningMemoryTable.patternType, "regime_shift"),
          gte(learningMemoryTable.createdAt, since)
        )
      )
      .orderBy(desc(learningMemoryTable.createdAt))
      .limit(limit);

    res.json({
      symbol,
      events: rows.map((r) => {
        const data = r.patternData as Record<string, unknown>;
        return {
          id: r.id,
          detectedAt: Math.floor(r.createdAt.getTime() / 1000),
          type: String(data?.type ?? "unknown"),
          severity: String(data?.severity ?? "info"),
          description: String(data?.description ?? ""),
        };
      }),
      total: rows.length,
    });
  } catch (err) {
    req.log.error({ err }, "Intelligence evolution failed");
    res.status(500).json({ error: "Evolution events fetch failed" });
  }
});

// â”€â”€ GET /intelligence/aggregated â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/intelligence/aggregated", async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const sinceStr = since.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(dailySummariesTable)
      .where(gte(dailySummariesTable.date, sinceStr))
      .orderBy(asc(dailySummariesTable.date));

    // Group by symbol
    const bySymbol = new Map<
      string,
      { avgQuality: number; avgConfidence: number; avgRisk: number; sampleCount: number; eliteCount: number; dangerousCount: number; days: number }
    >();

    for (const row of rows) {
      if (!bySymbol.has(row.symbol)) {
        bySymbol.set(row.symbol, {
          avgQuality: 0,
          avgConfidence: 0,
          avgRisk: 0,
          sampleCount: 0,
          eliteCount: 0,
          dangerousCount: 0,
          days: 0,
        });
      }
      const entry = bySymbol.get(row.symbol)!;
      entry.avgQuality += row.avgQuality;
      entry.avgConfidence += row.avgConfidence;
      entry.avgRisk += row.avgRisk;
      entry.sampleCount += row.sampleCount;
      entry.eliteCount += row.eliteCount;
      entry.dangerousCount += row.dangerousCount;
      entry.days++;
    }

    const symMeta = new Map(SUPPORTED_SYMBOLS.map((s) => [s.symbol, s]));
    const leaderboard = [];

    for (const [symbol, agg] of bySymbol) {
      const n = agg.days;
      leaderboard.push({
        symbol,
        displayName: symMeta.get(symbol)?.displayName ?? symbol,
        avgQuality: Math.round(agg.avgQuality / n),
        avgConfidence: Math.round(agg.avgConfidence / n),
        avgRisk: Math.round(agg.avgRisk / n),
        totalSamples: agg.sampleCount,
        eliteCount: agg.eliteCount,
        dangerousCount: agg.dangerousCount,
        daysTracked: n,
      });
    }

    leaderboard.sort((a, b) => b.avgQuality - a.avgQuality);

    res.json({
      leaderboard,
      since: sinceStr,
      generatedAt: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    req.log.error({ err }, "Intelligence aggregated failed");
    res.status(500).json({ error: "Aggregated intelligence fetch failed" });
  }
});

export default router;
