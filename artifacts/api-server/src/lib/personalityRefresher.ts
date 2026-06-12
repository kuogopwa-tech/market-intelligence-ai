/**
 * personalityRefresher.ts
 *
 * Derives and persists a behavioral personality label for a symbol by aggregating
 * the last 7 days of intelligence_snapshots â€” NOT just the latest scan result.
 * This means the personality classification improves over time as more scans
 * accumulate. Called once per symbol at the end of every background scan run.
 *
 * Stored in learning_memory as patternType = 'personality_snapshot' so the AI
 * service and analytics query can reference persisted classifications.
 */
import { db } from "@workspace/db";
import { learningMemoryTable, intelligenceSnapshotsTable } from "@workspace/db";
import { gte, eq, and } from "drizzle-orm";
import { isSystemReset } from "./backgroundScanner.js";
import { logger } from "./logger.js";

type PersonalityLabel =
  | "Clean Mover"
  | "Spike-Prone"
  | "Reversal Heavy"
  | "Trend Follower"
  | "Range-Bound"
  | "Frequently Volatile"
  | "Mixed Behavior";

function dominantValue(items: string[]): string {
  if (items.length === 0) return "Unknown";
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

function derivePersonalityFromHistory(rows: {
  marketState: string;
  alertType: string;
  riskScore: number;
  cleanSignalScore: number;
  marketCleanliness: string;
  noTradeZone: boolean;
  priorityLevel: string;
}[]): PersonalityLabel {
  if (rows.length === 0) return "Mixed Behavior";

  const total = rows.length;
  const spikeCount       = rows.filter((r) => r.marketState === "Spike Risk" || r.alertType === "Spike Detected").length;
  const cleanCount       = rows.filter((r) => r.marketCleanliness === "Clean" && r.cleanSignalScore >= 65).length;
  const highRiskCount    = rows.filter((r) => r.noTradeZone && r.riskScore >= 70).length;
  const trendCount       = rows.filter((r) => r.marketState === "Bullish" || r.marketState === "Bearish").length;
  const reversalCount    = rows.filter((r) => r.marketState === "Reversal Likely").length;
  const rangeBoundCount  = rows.filter((r) => r.marketState === "Ranging").length;
  const eliteCount       = rows.filter((r) => r.priorityLevel === "Elite Opportunity" || r.priorityLevel === "High Confidence").length;

  const spikePct       = spikeCount / total;
  const cleanPct       = cleanCount / total;
  const highRiskPct    = highRiskCount / total;
  const trendPct       = trendCount / total;
  const reversalPct    = reversalCount / total;
  const rangePct       = rangeBoundCount / total;

  // Priority: most extreme trait wins
  if (spikePct >= 0.40)                               return "Spike-Prone";
  if (highRiskPct >= 0.45)                            return "Frequently Volatile";
  if (cleanPct >= 0.35 && eliteCount / total >= 0.20) return "Clean Mover";
  if (trendPct >= 0.45)                               return "Trend Follower";
  if (reversalPct >= 0.35)                            return "Reversal Heavy";
  if (rangePct >= 0.40)                               return "Range-Bound";
  return "Mixed Behavior";
}

/**
 * Aggregates the last 7 days of intelligence_snapshots for `symbol`, derives
 * a stable personality label, and persists it to learning_memory.
 * History accumulates intentionally â€” does NOT upsert.
 */
export async function refreshSymbolPersonality(
  symbol: string,
  scanRunId: number | null
): Promise<void> {
  // Skip personality refresh if system reset is active
  const resetState = isSystemReset();
  if (resetState.active) {
    logger.info({ symbol }, "Personality refresh skipped - system reset in progress");
    return;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select({
        marketState: intelligenceSnapshotsTable.marketState,
        alertType: intelligenceSnapshotsTable.alertType,
        riskScore: intelligenceSnapshotsTable.riskScore,
        cleanSignalScore: intelligenceSnapshotsTable.cleanSignalScore,
        marketCleanliness: intelligenceSnapshotsTable.marketCleanliness,
        noTradeZone: intelligenceSnapshotsTable.noTradeZone,
        priorityLevel: intelligenceSnapshotsTable.priorityLevel,
      })
      .from(intelligenceSnapshotsTable)
      .where(
        and(
          eq(intelligenceSnapshotsTable.symbol, symbol),
          gte(intelligenceSnapshotsTable.snapshotAt, sevenDaysAgo)
        )
      );

    if (rows.length === 0) return; // not enough history yet

    const personality = derivePersonalityFromHistory(rows);
    const dominantState = dominantValue(rows.map((r) => r.marketState));
    const avgQuality = Math.round(rows.reduce((s, r) => s + r.cleanSignalScore, 0) / rows.length);
    const avgRisk    = Math.round(rows.reduce((s, r) => s + r.riskScore, 0) / rows.length);

    await db.insert(learningMemoryTable).values({
      symbol,
      patternType: "personality_snapshot",
      patternData: {
        personality,
        scanRunId,
        samplesUsed: rows.length,
        lookbackDays: 7,
        dominantState,
        avgQuality,
        avgRisk,
        derivedAt: new Date().toISOString(),
      },
      outcome: personality === "Clean Mover" || personality === "Trend Follower" ? "correct" : "incorrect",
      accuracy:
        personality === "Clean Mover"
          ? 80
          : personality === "Spike-Prone" || personality === "Frequently Volatile"
          ? 20
          : 50,
    });
  } catch (err) {
    // Non-fatal â€” log and continue
    logger.error({ err, symbol }, "Failed to persist personality snapshot");
  }
}
