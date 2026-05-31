import { db } from "@workspace/db";
import { hourlySummariesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface HourlyWindow {
  hour: number;
  avgQuality: number;
  avgConfidence: number;
  avgRisk: number;
  sampleCount: number;
  eliteCount: number;
  dangerousCount: number;
  label: string;
}

export interface TimingModel {
  symbol: string;
  windows: HourlyWindow[];
  bestWindows: HourlyWindow[];
  worstWindows: HourlyWindow[];
  hasData: boolean;
}

function hourLabel(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00 UTC`;
}

export async function getTimingModel(symbol: string): Promise<TimingModel> {
  const rows = await db
    .select()
    .from(hourlySummariesTable)
    .where(eq(hourlySummariesTable.symbol, symbol));

  if (rows.length === 0) {
    return {
      symbol,
      windows: [],
      bestWindows: [],
      worstWindows: [],
      hasData: false,
    };
  }

  // Aggregate across all dates for each hour slot (0–23)
  const hourAgg = new Map<
    number,
    {
      totalQuality: number;
      totalConfidence: number;
      totalRisk: number;
      totalSamples: number;
      eliteCount: number;
      dangerousCount: number;
      rowCount: number;
    }
  >();

  for (const row of rows) {
    const h = row.hour;
    if (!hourAgg.has(h)) {
      hourAgg.set(h, {
        totalQuality: 0,
        totalConfidence: 0,
        totalRisk: 0,
        totalSamples: 0,
        eliteCount: 0,
        dangerousCount: 0,
        rowCount: 0,
      });
    }
    const agg = hourAgg.get(h)!;
    agg.totalQuality += row.avgQuality * row.sampleCount;
    agg.totalConfidence += row.avgConfidence * row.sampleCount;
    agg.totalRisk += row.avgRisk * row.sampleCount;
    agg.totalSamples += row.sampleCount;
    agg.eliteCount += row.eliteCount;
    agg.dangerousCount += row.dangerousCount;
    agg.rowCount++;
  }

  const windows: HourlyWindow[] = [];
  for (let h = 0; h < 24; h++) {
    const agg = hourAgg.get(h);
    if (!agg || agg.totalSamples === 0) {
      windows.push({
        hour: h,
        avgQuality: 0,
        avgConfidence: 0,
        avgRisk: 0,
        sampleCount: 0,
        eliteCount: 0,
        dangerousCount: 0,
        label: hourLabel(h),
      });
    } else {
      windows.push({
        hour: h,
        avgQuality: Math.round(agg.totalQuality / agg.totalSamples),
        avgConfidence: Math.round(agg.totalConfidence / agg.totalSamples),
        avgRisk: Math.round(agg.totalRisk / agg.totalSamples),
        sampleCount: agg.totalSamples,
        eliteCount: agg.eliteCount,
        dangerousCount: agg.dangerousCount,
        label: hourLabel(h),
      });
    }
  }

  const populated = windows.filter((w) => w.sampleCount > 0);
  const sorted = [...populated].sort((a, b) => b.avgQuality - a.avgQuality);

  return {
    symbol,
    windows,
    bestWindows: sorted.slice(0, 3),
    worstWindows: sorted.slice(-3).reverse(),
    hasData: populated.length > 0,
  };
}
