import { Router } from "express";
import { db } from "@workspace/db";
import { symbolTimelineTable } from "@workspace/db";
import { eq, gte, desc, asc } from "drizzle-orm";
import { SUPPORTED_SYMBOLS } from "../lib/derivWs.js";

const router: Router = Router();

// â”€â”€â”€ Personality derivation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function derivePersonality(
  spikePct: number,
  cleanPct: number,
  reversalPct: number,
  trendPct: number,
  noTradePct: number,
  volatilePct: number
): string {
  if (spikePct >= 45) return "Spike-Prone";
  if (cleanPct >= 28 && volatilePct < 25) return "Clean Mover";
  if (reversalPct >= 25) return "Reversal Heavy";
  if (trendPct >= 55 && cleanPct >= 18) return "Trend Follower";
  if (noTradePct >= 40) return "Range-Bound";
  if (volatilePct >= 50) return "Frequently Volatile";
  return "Mixed Behavior";
}

function computeStability(priorityLevels: string[]): number {
  if (priorityLevels.length < 3) return 0;
  let sameAsNext = 0;
  for (let i = 0; i < priorityLevels.length - 1; i++) {
    if (priorityLevels[i] === priorityLevels[i + 1]) sameAsNext++;
  }
  return Math.round((sameAsNext / (priorityLevels.length - 1)) * 100);
}

function computePredictability(dominantPct: number, samples: number): number {
  if (samples < 3) return 0;
  const dataSufficiency = Math.min(samples / 20, 1);
  return Math.round(dominantPct * 0.75 + dataSufficiency * 25);
}

// â”€â”€â”€ GET /analytics/overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/analytics/overview", async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const entries = await db
      .select()
      .from(symbolTimelineTable)
      .where(gte(symbolTimelineTable.snapshotAt, since))
      .orderBy(asc(symbolTimelineTable.snapshotAt))
      .limit(10000);

    // Group by symbol
    const bySymbol = new Map<string, typeof entries>();
    for (const e of entries) {
      if (!bySymbol.has(e.symbol)) bySymbol.set(e.symbol, []);
      bySymbol.get(e.symbol)!.push(e);
    }

    const symMeta = new Map(SUPPORTED_SYMBOLS.map((s) => [s.symbol, s]));

    const profiles = [];

    for (const [symbol, rows] of bySymbol) {
      const n = rows.length;
      if (n === 0) continue;

      const avgQuality = rows.reduce((s, r) => s + r.cleanSignalScore, 0) / n;
      const avgConf = rows.reduce((s, r) => s + r.confidence, 0) / n;

      const spikePct = (rows.filter((r) => r.alertType.toLowerCase().includes("spike")).length / n) * 100;
      const cleanPct = (rows.filter((r) => r.cleanSignalScore >= 65).length / n) * 100;
      const reversalPct = (rows.filter((r) => r.alertType.toLowerCase().includes("reversal")).length / n) * 100;
      const trendPct = (rows.filter((r) => r.marketState === "Bullish" || r.marketState === "Bearish").length / n) * 100;
      const noTradePct = (rows.filter((r) => r.noTradeZone).length / n) * 100;
      const volatilePct = (rows.filter((r) => r.volatilityCompatibility < 35).length / n) * 100;
      const elitePct = (rows.filter((r) => r.priorityLevel === "Elite Opportunity").length / n) * 100;
      const dangerPct = (rows.filter((r) => r.priorityLevel === "Dangerous" || r.priorityLevel === "Avoid Market").length / n) * 100;

      // Dominant state
      const stateCounts = new Map<string, number>();
      for (const r of rows) stateCounts.set(r.marketState, (stateCounts.get(r.marketState) ?? 0) + 1);
      const dominantState = [...stateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
      const dominantStatePct = ((stateCounts.get(dominantState) ?? 0) / n) * 100;

      // Dominant alert
      const alertCounts = new Map<string, number>();
      for (const r of rows) alertCounts.set(r.alertType, (alertCounts.get(r.alertType) ?? 0) + 1);
      const dominantAlert = [...alertCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

      // Recent evolution (last 15 priority levels)
      const recentRows = [...rows].sort((a, b) => b.snapshotAt.getTime() - a.snapshotAt.getTime()).slice(0, 15);
      const recentEvolution = recentRows.map((r) => r.priorityLevel).reverse();

      const priorityLevels = rows.map((r) => r.priorityLevel);
      const stabilityScore = computeStability(priorityLevels);
      const predictabilityScore = computePredictability(dominantStatePct, n);
      const rhythmScore = Math.round(stabilityScore * 0.5 + Math.min(cleanPct, 50) * 0.5 + Math.min(elitePct * 2, 20));

      // Volatility fingerprint (avg per recent window)
      const recentVol = recentRows.reduce((s, r) => s + r.volatilityCompatibility, 0) / Math.max(recentRows.length, 1);

      profiles.push({
        symbol,
        displayName: symMeta.get(symbol)?.displayName ?? symbol,
        market: symMeta.get(symbol)?.market ?? "unknown",
        samplesAnalyzed: n,
        personality: derivePersonality(spikePct, cleanPct, reversalPct, trendPct, noTradePct, volatilePct),
        avgCleanSignalScore: Math.round(avgQuality),
        avgConfidence: Math.round(avgConf),
        volatilityScore: Math.round(volatilePct),
        trendReliability: Math.round(trendPct),
        reversalFrequency: Math.round(reversalPct),
        cleanSetupFrequency: Math.round(cleanPct),
        eliteFrequency: Math.round(elitePct),
        dangerousFrequency: Math.round(dangerPct),
        dominantState,
        dominantAlertType: dominantAlert,
        predictabilityScore,
        stabilityScore,
        rhythmScore,
        recentVol: Math.round(recentVol),
        recentEvolution,
      });
    }

    // Sort: most predictable / cleanest first
    profiles.sort((a, b) => b.predictabilityScore - a.predictabilityScore);

    res.json({
      profiles,
      totalSnapshots: entries.length,
      symbolsProfiled: profiles.length,
      lastUpdated: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    req.log.error({ err }, "Analytics overview failed");
    res.status(500).json({ error: "Analytics overview failed" });
  }
});

// â”€â”€â”€ GET /analytics/timeline/:symbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/analytics/timeline/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? "60"), 10), 200);

    const entries = await db
      .select()
      .from(symbolTimelineTable)
      .where(eq(symbolTimelineTable.symbol, symbol))
      .orderBy(desc(symbolTimelineTable.snapshotAt))
      .limit(limit);

    res.json({
      symbol,
      entries: entries.map((e) => ({
        id: e.id,
        snapshotAt: Math.floor(e.snapshotAt.getTime() / 1000),
        cleanSignalScore: e.cleanSignalScore,
        riskScore: e.riskScore,
        confidence: e.confidence,
        marketState: e.marketState,
        priorityLevel: e.priorityLevel,
        alertType: e.alertType,
        marketCleanliness: e.marketCleanliness,
        volatilityCompatibility: e.volatilityCompatibility,
        indicatorAlignment: e.indicatorAlignment,
        momentumConfirmation: e.momentumConfirmation,
        bullishScore: e.bullishScore,
        bearishScore: e.bearishScore,
        noTradeZone: e.noTradeZone,
        patternName: e.patternName,
        hour: e.hour,
      })),
      totalEntries: entries.length,
    });
  } catch (err) {
    req.log.error({ err }, "Analytics timeline failed");
    res.status(500).json({ error: "Analytics timeline failed" });
  }
});

// â”€â”€â”€ GET /analytics/heatmap/:symbol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/analytics/heatmap/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const entries = await db
      .select()
      .from(symbolTimelineTable)
      .where(eq(symbolTimelineTable.symbol, symbol))
      .orderBy(asc(symbolTimelineTable.snapshotAt))
      .limit(5000);

    const recentEntries = entries.filter((e) => e.snapshotAt >= since);

    // Build 24-hour slots
    const slots = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      avgQuality: 0,
      avgConfidence: 0,
      sampleCount: 0,
      eliteCount: 0,
      dangerousCount: 0,
      cleanCount: 0,
    }));

    for (const e of recentEntries) {
      const s = slots[e.hour];
      if (!s) continue;
      s.sampleCount++;
      s.avgQuality += e.cleanSignalScore;
      s.avgConfidence += e.confidence;
      if (e.priorityLevel === "Elite Opportunity") s.eliteCount++;
      if (e.priorityLevel === "Dangerous" || e.priorityLevel === "Avoid Market") s.dangerousCount++;
      if (e.cleanSignalScore >= 65) s.cleanCount++;
    }

    const finalSlots = slots.map((s) => ({
      hour: s.hour,
      avgQuality: s.sampleCount > 0 ? Math.round(s.avgQuality / s.sampleCount) : 0,
      avgConfidence: s.sampleCount > 0 ? Math.round(s.avgConfidence / s.sampleCount) : 0,
      sampleCount: s.sampleCount,
      eliteCount: s.eliteCount,
      dangerousCount: s.dangerousCount,
      cleanCount: s.cleanCount,
    }));

    const populated = finalSlots.filter((s) => s.sampleCount > 0);
    const bestSlot = populated.sort((a, b) => b.avgQuality - a.avgQuality)[0];
    const worstSlot = [...populated].sort((a, b) => b.dangerousCount - a.dangerousCount)[0];

    res.json({
      symbol,
      slots: finalSlots,
      bestHour: bestSlot?.hour ?? null,
      worstHour: worstSlot?.hour ?? null,
      hasData: populated.length > 0,
      totalSamples: recentEntries.length,
    });
  } catch (err) {
    req.log.error({ err }, "Analytics heatmap failed");
    res.status(500).json({ error: "Analytics heatmap failed" });
  }
});

export default router;
