import { db } from "@workspace/db";
import { hourlySummariesTable, dailySummariesTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import type { SymbolScanResult } from "./backgroundScanner";
import { logger } from "./logger";

// ── Retention config ──────────────────────────────────────────────────────────
const HOURLY_RETENTION_DAYS = 90;
const DAILY_RETENTION_DAYS = 365;

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dominantValue(items: string[]): string {
  if (items.length === 0) return "Unknown";
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

// ── Main aggregation entry point ───────────────────────────────────────────────

export async function runAggregation(
  results: SymbolScanResult[],
  now: Date
): Promise<void> {
  const date = dateStr(now);
  const hour = now.getUTCHours();

  // Group by symbol
  const bySymbol = new Map<string, SymbolScanResult[]>();
  for (const r of results) {
    if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, []);
    bySymbol.get(r.symbol)!.push(r);
  }

  for (const [symbol, rows] of bySymbol) {
    const n = rows.length;
    if (n === 0) continue;

    const avgQuality = rows.reduce((s, r) => s + r.cleanSignalScore, 0) / n;
    const avgConfidence = rows.reduce((s, r) => s + r.confidence, 0) / n;
    const avgRisk = rows.reduce((s, r) => s + r.riskScore, 0) / n;
    const avgVolatilityCompat = rows.reduce((s, r) => s + r.volatilityCompatibility, 0) / n;
    const eliteCount = rows.filter((r) => r.priorityLevel === "Elite Opportunity").length;
    const dangerousCount = rows.filter(
      (r) => r.priorityLevel === "Dangerous" || r.priorityLevel === "Avoid Market"
    ).length;
    const noTradeCount = rows.filter((r) => r.noTradeZone).length;
    const dominantState = dominantValue(rows.map((r) => r.marketState));
    const dominantPattern = dominantValue(rows.map((r) => r.patternName));

    // Upsert hourly summary — accumulate if row exists
    try {
      const existing = await db
        .select()
        .from(hourlySummariesTable)
        .where(
          and(
            eq(hourlySummariesTable.symbol, symbol),
            eq(hourlySummariesTable.date, date),
            eq(hourlySummariesTable.hour, hour)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const prev = existing[0];
        const totalN = prev.sampleCount + n;
        await db
          .update(hourlySummariesTable)
          .set({
            avgQuality: (prev.avgQuality * prev.sampleCount + avgQuality * n) / totalN,
            avgConfidence: (prev.avgConfidence * prev.sampleCount + avgConfidence * n) / totalN,
            avgRisk: (prev.avgRisk * prev.sampleCount + avgRisk * n) / totalN,
            avgVolatilityCompat:
              (prev.avgVolatilityCompat * prev.sampleCount + avgVolatilityCompat * n) / totalN,
            sampleCount: totalN,
            eliteCount: prev.eliteCount + eliteCount,
            dangerousCount: prev.dangerousCount + dangerousCount,
            noTradeCount: prev.noTradeCount + noTradeCount,
            dominantState,
            dominantPattern,
            updatedAt: new Date(),
          })
          .where(eq(hourlySummariesTable.id, prev.id));
      } else {
        await db.insert(hourlySummariesTable).values({
          symbol,
          date,
          hour,
          avgQuality,
          avgConfidence,
          avgRisk,
          avgVolatilityCompat,
          sampleCount: n,
          eliteCount,
          dangerousCount,
          noTradeCount,
          dominantState,
          dominantPattern,
        });
      }
    } catch (err) {
      logger.error({ err, symbol }, "Failed to upsert hourly summary");
    }

    // Upsert daily summary
    try {
      const existingDaily = await db
        .select()
        .from(dailySummariesTable)
        .where(
          and(
            eq(dailySummariesTable.symbol, symbol),
            eq(dailySummariesTable.date, date)
          )
        )
        .limit(1);

      if (existingDaily.length > 0) {
        const prev = existingDaily[0];
        const totalN = prev.sampleCount + n;
        await db
          .update(dailySummariesTable)
          .set({
            avgQuality: (prev.avgQuality * prev.sampleCount + avgQuality * n) / totalN,
            avgConfidence: (prev.avgConfidence * prev.sampleCount + avgConfidence * n) / totalN,
            avgRisk: (prev.avgRisk * prev.sampleCount + avgRisk * n) / totalN,
            sampleCount: totalN,
            eliteCount: prev.eliteCount + eliteCount,
            dangerousCount: prev.dangerousCount + dangerousCount,
            dominantState,
            updatedAt: new Date(),
          })
          .where(eq(dailySummariesTable.id, prev.id));
      } else {
        await db.insert(dailySummariesTable).values({
          symbol,
          date,
          avgQuality,
          avgConfidence,
          avgRisk,
          sampleCount: n,
          eliteCount,
          dangerousCount,
          dominantState,
          dominantPersonality: "Mixed Behavior",
        });
      }
    } catch (err) {
      logger.error({ err, symbol }, "Failed to upsert daily summary");
    }
  }

  // Prune old rows (rolling retention)
  try {
    const hourlyRetentionDate = new Date(now);
    hourlyRetentionDate.setDate(hourlyRetentionDate.getDate() - HOURLY_RETENTION_DAYS);
    await db
      .delete(hourlySummariesTable)
      .where(lt(hourlySummariesTable.date, dateStr(hourlyRetentionDate)));

    const dailyRetentionDate = new Date(now);
    dailyRetentionDate.setDate(dailyRetentionDate.getDate() - DAILY_RETENTION_DAYS);
    await db
      .delete(dailySummariesTable)
      .where(lt(dailySummariesTable.date, dateStr(dailyRetentionDate)));
  } catch (err) {
    logger.error({ err }, "Failed to prune old aggregation rows");
  }
}
