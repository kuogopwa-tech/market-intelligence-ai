import { db } from "@workspace/db";
import {
  hourlySummariesTable,
  learningMemoryTable,
} from "@workspace/db";
import { gte, lt, and, sql } from "drizzle-orm";
import { logger } from "./logger";

const QUALITY_SHIFT_THRESHOLD = 15;

function dominantValue(items: string[]): string {
  if (items.length === 0) return "Unknown";
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

// Build a stable deduplication key for an event. Two events with the same key in the
// same 24-hour window are considered duplicates and will NOT be re-inserted.
function eventKey(symbol: string, type: string, windowStart: Date): string {
  const daySlot = windowStart.toISOString().slice(0, 13); // YYYY-MM-DDTHH — hour-resolution bucket
  return `${symbol}|${type}|${daySlot}`;
}

export async function detectEvolution(): Promise<void> {
  const now = new Date();

  // True rolling windows — not fixed calendar-day buckets.
  const recentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);  // now - 24h
  const priorStart  = new Date(now.getTime() - 48 * 60 * 60 * 1000);  // now - 48h

  const recentStartStr = recentStart.toISOString().slice(0, 10);
  const priorStartStr  = priorStart.toISOString().slice(0, 10);
  const nowStr         = now.toISOString().slice(0, 10);

  const [recentRows, priorRows] = await Promise.all([
    db
      .select()
      .from(hourlySummariesTable)
      .where(
        and(
          gte(hourlySummariesTable.date, recentStartStr),
          lt(hourlySummariesTable.date, nowStr)
        )
      ),
    db
      .select()
      .from(hourlySummariesTable)
      .where(
        and(
          gte(hourlySummariesTable.date, priorStartStr),
          lt(hourlySummariesTable.date, recentStartStr)
        )
      ),
  ]);

  if (recentRows.length === 0 || priorRows.length === 0) return;

  // Load recent regime-shift events for deduplication check (last 24h)
  const existingEvents = await db
    .select({
      patternData: learningMemoryTable.patternData,
      symbol: learningMemoryTable.symbol,
    })
    .from(learningMemoryTable)
    .where(
      and(
        gte(learningMemoryTable.createdAt, recentStart),
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

    const recentAvgQ = recent.reduce((s, r) => s + r.avgQuality, 0) / recent.length;
    const priorAvgQ  = prior.reduce((s, r) => s + r.avgQuality, 0) / prior.length;
    const qualityDelta = recentAvgQ - priorAvgQ;

    const recentState = dominantValue(recent.map((r) => r.dominantState));
    const priorState  = dominantValue(prior.map((r) => r.dominantState));

    const recentElite  = recent.reduce((s, r) => s + r.eliteCount, 0);
    const priorElite   = prior.reduce((s, r) => s + r.eliteCount, 0);
    const recentDanger = recent.reduce((s, r) => s + r.dangerousCount, 0);
    const priorDanger  = prior.reduce((s, r) => s + r.dangerousCount, 0);

    function shouldEmit(type: string): boolean {
      return !existingKeys.has(eventKey(symbol, type, recentStart));
    }

    // Quality regime shift
    if (Math.abs(qualityDelta) >= QUALITY_SHIFT_THRESHOLD && shouldEmit("quality_shift")) {
      const direction = qualityDelta > 0 ? "improved" : "deteriorated";
      const severity  = qualityDelta > 0 ? "info" : "warning";
      shiftEvents.push({
        symbol,
        type: "quality_shift",
        description: `Signal quality ${direction} by ${Math.abs(Math.round(qualityDelta))} points (${Math.round(priorAvgQ)} → ${Math.round(recentAvgQ)})`,
        severity,
      });
    }

    // Market state transition
    if (recentState !== priorState && recentState !== "Unknown" && priorState !== "Unknown" && shouldEmit("state_transition")) {
      shiftEvents.push({
        symbol,
        type: "state_transition",
        description: `Market regime shifted from ${priorState} to ${recentState}`,
        severity: "info",
      });
    }

    // Elite opportunity surge
    if (recentElite >= priorElite * 2 && recentElite >= 3 && shouldEmit("elite_surge")) {
      shiftEvents.push({
        symbol,
        type: "elite_surge",
        description: `Elite opportunity frequency doubled (${priorElite} → ${recentElite} in 24h)`,
        severity: "info",
      });
    }

    // Danger spike
    if (recentDanger >= priorDanger * 2 && recentDanger >= 3 && shouldEmit("danger_spike")) {
      shiftEvents.push({
        symbol,
        type: "danger_spike",
        description: `Dangerous condition frequency doubled (${priorDanger} → ${recentDanger} in 24h) — caution advised`,
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
          // Store the window start so dedup key can be reconstructed on next run
          windowStart: windowStartIso,
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
