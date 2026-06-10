import type { IndicatorSet } from "./indicators.js";

export interface PatternClassification {
  name: string;
  rsiZone: "oversold" | "neutral-low" | "neutral" | "neutral-high" | "overbought";
  macdBias: "bullish" | "bearish" | "neutral";
  emaStructure: "bullish" | "bearish" | "mixed";
  atrLevel: "low" | "moderate" | "high";
  stochZone: "oversold" | "neutral" | "overbought";
}

export interface PatternStat {
  pattern: string;
  description: string;
  successRate: number;
  totalTrades: number;
  wins: number;
  losses: number;
  dominantDirection: string;
  avgConfidence: number;
}

export interface LessonEntry {
  lesson: string;
  type: "success" | "warning" | "info";
  pattern: string;
  successRate: number;
}

const PATTERN_DESCRIPTIONS: Record<string, string> = {
  "Bullish Continuation": "EMA bullish alignment with MACD support â€” momentum continuation setup",
  "Bearish Continuation": "EMA bearish alignment with MACD below signal â€” downward momentum",
  "Bullish Exhaustion": "Overbought RSI with bullish EMA â€” potential reversal or correction ahead",
  "Bearish Exhaustion": "Oversold RSI with bearish EMA â€” potential bounce or recovery zone",
  "High Volatility Spike": "ATR elevated â€” unpredictable price action, reduce risk exposure",
  "Low Volatility Consolidation": "Mixed EMA with low ATR â€” breakout imminent, direction unclear",
  "Double Oversold": "RSI and Stochastic both oversold â€” strong bounce potential zone",
  "Double Overbought": "RSI and Stochastic both overbought â€” strong reversal risk zone",
  "Bullish Reversal Signal": "MACD turning bullish despite bearish EMA â€” early reversal forming",
  "Bearish Reversal Signal": "MACD turning bearish despite bullish EMA â€” early reversal forming",
  "Mixed Signals": "Conflicting indicator readings â€” no clear directional bias, wait for clarity",
  "prediction_outcome": "Recorded prediction outcome for adaptive learning",
};

export function classifyIndicatorPattern(indicators: IndicatorSet): PatternClassification {
  const { rsi, macdLine, macdSignal, ema9, ema21, ema50, atr, stochasticK } = indicators;

  const rsiZone =
    rsi === null
      ? "neutral"
      : rsi > 70
      ? "overbought"
      : rsi > 58
      ? "neutral-high"
      : rsi < 30
      ? "oversold"
      : rsi < 42
      ? "neutral-low"
      : "neutral";

  const macdBias =
    macdLine === null || macdSignal === null
      ? "neutral"
      : macdLine > macdSignal
      ? "bullish"
      : "bearish";

  const emaStructure =
    ema9 === null || ema21 === null || ema50 === null
      ? "mixed"
      : ema9 > ema21 && ema21 > ema50
      ? "bullish"
      : ema9 < ema21 && ema21 < ema50
      ? "bearish"
      : "mixed";

  const atrLevel =
    atr === null ? "moderate" : atr < 0.0005 ? "low" : atr > 0.002 ? "high" : "moderate";

  const stochZone =
    stochasticK === null
      ? "neutral"
      : stochasticK > 80
      ? "overbought"
      : stochasticK < 20
      ? "oversold"
      : "neutral";

  let name: string;
  if (atrLevel === "high") {
    name = "High Volatility Spike";
  } else if (rsiZone === "oversold" && stochZone === "oversold") {
    name = "Double Oversold";
  } else if (rsiZone === "overbought" && stochZone === "overbought") {
    name = "Double Overbought";
  } else if (rsiZone === "overbought" && emaStructure === "bullish") {
    name = "Bullish Exhaustion";
  } else if (rsiZone === "oversold" && emaStructure === "bearish") {
    name = "Bearish Exhaustion";
  } else if (emaStructure === "bullish" && macdBias === "bullish" && rsiZone !== "overbought") {
    name = "Bullish Continuation";
  } else if (emaStructure === "bearish" && macdBias === "bearish" && rsiZone !== "oversold") {
    name = "Bearish Continuation";
  } else if (macdBias === "bullish" && emaStructure === "bearish") {
    name = "Bullish Reversal Signal";
  } else if (macdBias === "bearish" && emaStructure === "bullish") {
    name = "Bearish Reversal Signal";
  } else if (emaStructure === "mixed" && atrLevel === "low") {
    name = "Low Volatility Consolidation";
  } else {
    name = "Mixed Signals";
  }

  return { name, rsiZone, macdBias, emaStructure, atrLevel, stochZone };
}

type MemoryRow = {
  patternType: string;
  outcome: string;
  accuracy: number | null;
  patternData: unknown;
  symbol: string;
};

export function computePatternStats(memories: MemoryRow[]): PatternStat[] {
  const stats = new Map<
    string,
    { wins: number; losses: number; confidences: number[]; directions: string[] }
  >();

  for (const mem of memories) {
    const pattern = mem.patternType;
    if (!stats.has(pattern)) {
      stats.set(pattern, { wins: 0, losses: 0, confidences: [], directions: [] });
    }
    const s = stats.get(pattern)!;
    if (mem.outcome === "correct") s.wins++;
    else if (mem.outcome === "incorrect") s.losses++;
    if (mem.accuracy !== null) s.confidences.push(mem.accuracy);
    const data = mem.patternData as Record<string, unknown>;
    if (data?.direction) s.directions.push(String(data.direction));
  }

  const result: PatternStat[] = [];
  for (const [pattern, s] of stats.entries()) {
    const total = s.wins + s.losses;
    if (total === 0) continue;
    const successRate = parseFloat(((s.wins / total) * 100).toFixed(1));
    const avgConfidence =
      s.confidences.length > 0
        ? parseFloat((s.confidences.reduce((a, b) => a + b, 0) / s.confidences.length).toFixed(1))
        : 0;
    const riseCt = s.directions.filter((d) => d === "rise").length;
    const fallCt = s.directions.filter((d) => d === "fall").length;
    const dominantDirection = riseCt >= fallCt ? "rise" : "fall";

    result.push({
      pattern,
      description: PATTERN_DESCRIPTIONS[pattern] ?? `Pattern: ${pattern}`,
      successRate,
      totalTrades: total,
      wins: s.wins,
      losses: s.losses,
      dominantDirection,
      avgConfidence,
    });
  }

  return result.sort((a, b) => b.totalTrades - a.totalTrades);
}

export function generateLessons(memories: MemoryRow[]): LessonEntry[] {
  const stats = computePatternStats(memories);
  const lessons: LessonEntry[] = [];

  for (const stat of stats) {
    if (stat.totalTrades < 2) continue;

    if (stat.successRate >= 70) {
      lessons.push({
        lesson: `${stat.pattern} succeeded ${stat.successRate}% of the time across ${stat.totalTrades} trades â€” reliable setup with ${stat.dominantDirection === "rise" ? "bullish" : "bearish"} bias`,
        type: "success",
        pattern: stat.pattern,
        successRate: stat.successRate,
      });
    } else if (stat.successRate >= 55) {
      lessons.push({
        lesson: `${stat.pattern} shows ${stat.successRate}% success rate â€” moderate edge, requires additional confirmation`,
        type: "info",
        pattern: stat.pattern,
        successRate: stat.successRate,
      });
    } else if (stat.successRate <= 35) {
      lessons.push({
        lesson: `${stat.pattern} failed ${(100 - stat.successRate).toFixed(1)}% of the time â€” avoid or apply inverse bias`,
        type: "warning",
        pattern: stat.pattern,
        successRate: stat.successRate,
      });
    }
  }

  if (lessons.length === 0 && memories.length >= 2) {
    lessons.push({
      lesson: "Early stage â€” patterns forming but need more data to establish reliable edge",
      type: "info",
      pattern: "general",
      successRate: 0,
    });
  } else if (memories.length === 0) {
    lessons.push({
      lesson: "No predictions recorded yet â€” start tracking to build adaptive pattern memory",
      type: "info",
      pattern: "general",
      successRate: 0,
    });
  }

  return lessons.sort((a, b) => {
    const order = { success: 0, warning: 1, info: 2 };
    return order[a.type] - order[b.type];
  });
}
