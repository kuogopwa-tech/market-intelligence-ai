import { db } from "@workspace/db";
import {
  hourlySummariesTable,
  learningMemoryTable,
} from "@workspace/db";
import { gte, lt, and, eq } from "drizzle-orm";
import { logger } from "./logger";

const QUALITY_SHIFT_THRESHOLD = 15;
const STATE_SHIFT_ENABLED = true;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dominantValue(items: string[]): string {
  if (items.length === 0) return "Unknown";
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

export async function detectEvolution(): Promise<void> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const todayStr = dateStr(now);
  const yesterdayStr = dateStr(yesterday);
  const twoDaysAgoStr = dateStr(twoDaysAgo);

  // Load last 24h and prior 24h hourly summaries
  const [recentRows, priorRows] = await Promise.all([
    db
      .select()
      .from(hourlySummariesTable)
      .where(
        and(
          gte(hourlySummariesTable.date, yesterdayStr),
          lt(hourlySummariesTable.date, todayStr)
        )
      ),
    db
      .select()
      .from(hourlySummariesTable)
      .where(
        and(
          gte(hourlySummariesTable.date, twoDaysAgoStr),
          lt(hourlySummariesTable.date, yesterdayStr)
        )
      ),
  ]);

  if (recentRows.length === 0 || priorRows.length === 0) return;

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
    const prior = priorRows.filter((r) => r.symbol === symbol);
    if (recent.length === 0 || prior.length === 0) continue;

    const recentAvgQ =
      recent.reduce((s, r) => s + r.avgQuality, 0) / recent.length;
    const priorAvgQ =
      prior.reduce((s, r) => s + r.avgQuality, 0) / prior.length;
    const qualityDelta = recentAvgQ - priorAvgQ;

    const recentState = dominantValue(recent.map((r) => r.dominantState));
    const priorState = dominantValue(prior.map((r) => r.dominantState));

    const recentElite = recent.reduce((s, r) => s + r.eliteCount, 0);
    const priorElite = prior.reduce((s, r) => s + r.eliteCount, 0);
    const recentDanger = recent.reduce((s, r) => s + r.dangerousCount, 0);
    const priorDanger = prior.reduce((s, r) => s + r.dangerousCount, 0);

    // Quality regime shift
    if (Math.abs(qualityDelta) >= QUALITY_SHIFT_THRESHOLD) {
      const direction = qualityDelta > 0 ? "improved" : "deteriorated";
      const severity = qualityDelta > 0 ? "info" : "warning";
      shiftEvents.push({
        symbol,
        type: "quality_shift",
        description: `Signal quality ${direction} by ${Math.abs(Math.round(qualityDelta))} points (${Math.round(priorAvgQ)} → ${Math.round(recentAvgQ)})`,
        severity,
      });
    }

    // Market state transition
    if (STATE_SHIFT_ENABLED && recentState !== priorState && recentState !== "Unknown" && priorState !== "Unknown") {
      shiftEvents.push({
        symbol,
        type: "state_transition",
        description: `Market regime shifted from ${priorState} to ${recentState}`,
        severity: "info",
      });
    }

    // Elite opportunity surge
    if (recentElite >= priorElite * 2 && recentElite >= 3) {
      shiftEvents.push({
        symbol,
        type: "elite_surge",
        description: `Elite opportunity frequency doubled (${priorElite} → ${recentElite} in 24h)`,
        severity: "info",
      });
    }

    // Danger spike
    if (recentDanger >= priorDanger * 2 && recentDanger >= 3) {
      shiftEvents.push({
        symbol,
        type: "danger_spike",
        description: `Dangerous condition frequency doubled (${priorDanger} → ${recentDanger} in 24h) — caution advised`,
        severity: "alert",
      });
    }
  }

  if (shiftEvents.length === 0) return;

  // Write shift events to learning_memory with pattern_type = 'regime_shift'
  try {
    await db.insert(learningMemoryTable).values(
      shiftEvents.map((e) => ({
        symbol: e.symbol,
        patternType: "regime_shift",
        patternData: {
          type: e.type,
          severity: e.severity,
          description: e.description,
          detectedAt: new Date().toISOString(),
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
