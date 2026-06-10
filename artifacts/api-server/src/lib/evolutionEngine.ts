import { db } from "@workspace/db";
import {
  intelligenceSnapshotsTable,
  learningMemoryTable,
} from "@workspace/db";
import { gte, lt, and, sql, eq } from "drizzle-orm";
import { logger } from "./logger.js";

const QUALITY_SHIFT_THRESHOLD     = 15;  // points
const VOLATILITY_SHIFT_THRESHOLD  = 20;  // points on volatilityCompatibility scale

function dominantValue(items: string[]): string {
  if (items.length === 0) return "Unknown";
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

// Dedup key â€” an event with the same symbol + type within the same 1-hour bucket
// is considered a duplicate and will NOT be re-inserted.
function eventKey(symbol: string, type: string, windowStart: Date): string {
  const hourBucket = windowStart.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return `${symbol}|${type}|${hourBucket}`;
}

export async function detectEvolution(): Promise<void> {
  const now = new Date();

  // True rolling timestamp windows â€” no date-string bucket rounding.
  const recentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // now - 24h
  const priorStart  = new Date(now.getTime() - 48 * 60 * 60 * 1000); // now - 48h

  // Load intelligence snapshots directly (timestamp precision, not hourly summaries)
  const [recentRows, priorRows] = await Promise.all([
    db
      .select({
        symbol: intelligenceSnapshotsTable.symbol,
        cleanSignalScore: intelligenceSnapshotsTable.cleanSignalScore,
        riskScore: intelligenceSnapshotsTable.riskScore,
        marketState: intelligenceSnapshotsTable.marketState,
        volatilityCompatibility: intelligenceSnapshotsTable.volatilityCompatibility,
        priorityLevel: intelligenceSnapshotsTable.priorityLevel,
        noTradeZone: intelligenceSnapshotsTable.noTradeZone,
        alertType: intelligenceSnapshotsTable.alertType,
      })
      .from(intelligenceSnapshotsTable)
      .where(
        and(
          gte(intelligenceSnapshotsTable.snapshotAt, recentStart),
          lt(intelligenceSnapshotsTable.snapshotAt, now)
        )
      ),
    db
      .select({
        symbol: intelligenceSnapshotsTable.symbol,
        cleanSignalScore: intelligenceSnapshotsTable.cleanSignalScore,
        riskScore: intelligenceSnapshotsTable.riskScore,
        marketState: intelligenceSnapshotsTable.marketState,
        volatilityCompatibility: intelligenceSnapshotsTable.volatilityCompatibility,
        priorityLevel: intelligenceSnapshotsTable.priorityLevel,
        noTradeZone: intelligenceSnapshotsTable.noTradeZone,
        alertType: intelligenceSnapshotsTable.alertType,
      })
      .from(intelligenceSnapshotsTable)
      .where(
        and(
          gte(intelligenceSnapshotsTable.snapshotAt, priorStart),
          lt(intelligenceSnapshotsTable.snapshotAt, recentStart)
        )
      ),
  ]);

  if (recentRows.length === 0 || priorRows.length === 0) return;

  // Load existing regime-shift events from last 25h for deduplication
  const dedupWindow = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const existingEvents = await db
    .select({
      patternData: learningMemoryTable.patternData,
      symbol: learningMemoryTable.symbol,
    })
    .from(learningMemoryTable)
    .where(
      and(
        gte(learningMemoryTable.createdAt, dedupWindow),
        eq(learningMemoryTable.patternType, "regime_shift"),
        sql`${learningMemoryTable.patternData}->>'type' IS NOT NULL`
      )
    );

  const existingKeys = new Set<string>(
    existingEvents
      .map((row) => {
        const pd = row.patternData as Record<string, unknown> | null;
        if (!pd || typeof pd !== "object") return null;
        const type = pd["type"] as string | undefined;
        const windowStartStr = pd["windowStart"] as string | undefined;
        if (!type || !windowStartStr) return null;
        return `${row.symbol}|${type}|${windowStartStr.slice(0, 13)}`;
      })
      .filter((k): k is string => k !== null)
  );

  // Group by symbol
  const symbols = new Set([
    ...recentRows.map((r) => r.symbol),
    ...priorRows.map((r) => r.symbol),
  ]);

  const shiftEvents: Array<{
    symbol: string;
    type: string;
    description: string;
    severity: "info" | "warning" | "alert";
  }> = [];

  for (const symbol of symbols) {
    const recent = recentRows.filter((r) => r.symbol === symbol);
    const prior  = priorRows.filter((r) => r.symbol === symbol);
    if (recent.length === 0 || prior.length === 0) continue;

    const recentAvgQ    = recent.reduce((s, r) => s + r.cleanSignalScore, 0) / recent.length;
    const priorAvgQ     = prior.reduce((s, r) => s + r.cleanSignalScore, 0) / prior.length;
    const qualityDelta  = recentAvgQ - priorAvgQ;

    const recentAvgVol  = recent.reduce((s, r) => s + r.volatilityCompatibility, 0) / recent.length;
    const priorAvgVol   = prior.reduce((s, r) => s + r.volatilityCompatibility, 0) / prior.length;
    const volDelta      = recentAvgVol - priorAvgVol;

    const recentState   = dominantValue(recent.map((r) => r.marketState));
    const priorState    = dominantValue(prior.map((r) => r.marketState));

    const recentElite   = recent.filter((r) => r.priorityLevel === "Elite Opportunity" || r.priorityLevel === "High Confidence").length;
    const priorElite    = prior.filter((r) => r.priorityLevel === "Elite Opportunity" || r.priorityLevel === "High Confidence").length;
    const recentDanger  = recent.filter((r) => r.priorityLevel === "Dangerous" || r.priorityLevel === "Avoid Market").length;
    const priorDanger   = prior.filter((r) => r.priorityLevel === "Dangerous" || r.priorityLevel === "Avoid Market").length;

    function shouldEmit(type: string): boolean {
      return !existingKeys.has(eventKey(symbol, type, recentStart));
    }

    // â”€â”€ Quality regime shift â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (Math.abs(qualityDelta) >= QUALITY_SHIFT_THRESHOLD && shouldEmit("quality_shift")) {
      const direction = qualityDelta > 0 ? "improved" : "deteriorated";
      const severity  = qualityDelta > 0 ? "info" : "warning";
      shiftEvents.push({
        symbol,
        type: "quality_shift",
        description: `Signal quality ${direction} by ${Math.abs(Math.round(qualityDelta))} pts (${Math.round(priorAvgQ)} â†’ ${Math.round(recentAvgQ)}) over 24h rolling window`,
        severity,
      });
    }

    // â”€â”€ Volatility compatibility shift (new) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (Math.abs(volDelta) >= VOLATILITY_SHIFT_THRESHOLD && shouldEmit("volatility_shift")) {
      const direction = volDelta > 0 ? "improved" : "worsened";
      const severity  = volDelta < 0 ? "warning" : "info";
      shiftEvents.push({
        symbol,
        type: "volatility_shift",
        description: `Volatility compatibility ${direction} by ${Math.abs(Math.round(volDelta))} pts (${Math.round(priorAvgVol)} â†’ ${Math.round(recentAvgVol)}) â€” ${volDelta < 0 ? "market conditions less favorable" : "market settling, better timing available"}`,
        severity,
      });
    }

    // â”€â”€ Market state transition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (recentState !== priorState && recentState !== "Unknown" && priorState !== "Unknown" && shouldEmit("state_transition")) {
      shiftEvents.push({
        symbol,
        type: "state_transition",
        description: `Market regime shifted from ${priorState} to ${recentState}`,
        severity: "info",
      });
    }

    // â”€â”€ Elite opportunity surge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (recentElite >= priorElite * 2 && recentElite >= 3 && shouldEmit("elite_surge")) {
      shiftEvents.push({
        symbol,
        type: "elite_surge",
        description: `Elite opportunity frequency doubled (${priorElite} â†’ ${recentElite} in 24h window)`,
        severity: "info",
      });
    }

    // â”€â”€ Danger spike â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (recentDanger >= priorDanger * 2 && recentDanger >= 3 && shouldEmit("danger_spike")) {
      shiftEvents.push({
        symbol,
        type: "danger_spike",
        description: `Dangerous condition frequency doubled (${priorDanger} â†’ ${recentDanger} in 24h window) â€” caution advised`,
        severity: "alert",
      });
    }
  }

  if (shiftEvents.length === 0) return;

  const windowStartIso = recentStart.toISOString();
  try {
    await db.insert(learningMemoryTable).values(
      shiftEvents.map((e) => ({
        symbol: e.symbol,
        patternType: "regime_shift",
        patternData: {
          type: e.type,
          severity: e.severity,
          description: e.description,
          detectedAt: now.toISOString(),
          windowStart: windowStartIso, // stored for dedup key reconstruction
        },
        outcome: e.severity === "alert" ? "incorrect" : "correct",
        accuracy: e.severity === "alert" ? 0 : e.severity === "info" ? 75 : 50,
      }))
    );
    logger.info({ count: shiftEvents.length }, "Evolution events recorded");
  } catch (err) {
    logger.error({ err }, "Failed to write evolution events");
  }
}
