import { logger } from "./logger";
import type { IndicatorSet } from "./indicators";
import { detectMarketCondition } from "./indicators";
import { mergeSignals, type SignalResult } from "./signalEngine";

const AI_BASE_URL = process.env.AI_BASE_URL ?? "http://localhost:11434";
const AI_MODEL = process.env.AI_MODEL ?? "qwen2.5:3b";
const CACHE_TTL_MS = 5 * 60 * 1000;
const AI_TIMEOUT_MS = 25000;

export interface AnalysisResult {
  reasoning: string;
  riseProbability: number;
  fallProbability: number;
  confidence: number;
  marketCondition: string;
  marketState: string;
  riskLevel: string;
  bullishScore: number;
  bearishScore: number;
  noTradeZone: boolean;
  signals: string[];
  warnings: string[];
  aiModel: string | null;
  cached: boolean;
}

interface CacheEntry {
  result: AnalysisResult;
  ts: number;
}

const analysisCache = new Map<string, CacheEntry>();

export async function checkAiOnline(): Promise<{
  online: boolean;
  model: string | null;
  provider: string | null;
  responseTimeMs: number | null;
  error: string | null;
}> {
  const start = Date.now();
  try {
    const res = await fetch(`${AI_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: { name: string }[] };
    const model = data.models?.[0]?.name ?? AI_MODEL;
    return {
      online: true,
      model,
      provider: "ollama",
      responseTimeMs: Date.now() - start,
      error: null,
    };
  } catch {
    try {
      const res2 = await fetch(`${AI_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      return {
        online: true,
        model: AI_MODEL,
        provider: "llama.cpp",
        responseTimeMs: Date.now() - start,
        error: null,
      };
    } catch (err2) {
      return {
        online: false,
        model: null,
        provider: null,
        responseTimeMs: null,
        error: String(err2),
      };
    }
  }
}

async function queryAi(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.25, num_predict: 500, top_p: 0.9 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const data = (await res.json()) as { response?: string };
    return data.response ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(
  symbol: string,
  indicators: IndicatorSet,
  signals: SignalResult,
  memoryContext: string
): string {
  const { rsi, macdLine, macdSignal, ema9, ema21, ema50, atr, stochasticK } = indicators;
  const cond = detectMarketCondition(indicators);

  const signalSummary = [
    ...signals.supportingSignals.map((s) => `  + ${s}`),
    ...signals.conflictingSignals.map((s) => `  ~ ${s}`),
  ].join("\n");

  return `You are a professional market analyst for ${symbol}.

SIGNAL ENGINE RESULTS:
Market State: ${signals.marketState}
Bullish Score: ${signals.bullishScore}/100 | Bearish Score: ${signals.bearishScore}/100
Confidence: ${signals.confidence}% | Risk Level: ${signals.riskLevel}
No-Trade Zone: ${signals.noTradeZone ? "YES — signals too conflicting" : "No"}

Key Signals:
${signalSummary || "  No clear signals detected"}

RAW INDICATORS:
- RSI(14): ${rsi?.toFixed(2) ?? "N/A"} (${rsi ? (rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral") : "N/A"})
- MACD: Line=${macdLine?.toFixed(5) ?? "N/A"} Signal=${macdSignal?.toFixed(5) ?? "N/A"}
- EMA: 9=${ema9?.toFixed(4) ?? "N/A"} 21=${ema21?.toFixed(4) ?? "N/A"} 50=${ema50?.toFixed(4) ?? "N/A"}
- Stochastic: ${stochasticK?.toFixed(1) ?? "N/A"} | ATR: ${atr?.toFixed(5) ?? "N/A"}
- Trend: ${cond.trend} | Momentum: ${cond.momentum} | Volatility: ${cond.volatility}
${memoryContext ? `\nHISTORICAL MEMORY:\n${memoryContext}` : ""}

${
  signals.noTradeZone
    ? `IMPORTANT: Market signals are conflicting. If you agree, set confidence below 40 and recommend avoiding directional trades.`
    : ""
}

Respond ONLY in this exact JSON format (no other text):
{
  "reasoning": "3-4 sentence analysis explaining WHY market may rise or fall, which indicators conflict, and what the momentum/trend quality is",
  "rise_probability": <0-100 integer>,
  "fall_probability": <0-100 integer>,
  "confidence": <0-100 integer>,
  "signals": ["signal detail 1", "signal detail 2", "signal detail 3"],
  "warnings": ["warning 1"]
}

Rules:
- rise_probability + fall_probability = 100
- If no-trade zone, set confidence below 40
- Reference specific indicator values in reasoning
- Keep reasoning under 200 words
- Be direct and analytical`;
}

function buildRuleBasedReasoning(
  symbol: string,
  indicators: IndicatorSet,
  signals: SignalResult
): string {
  const cond = detectMarketCondition(indicators);
  const { rsi, macdLine, macdSignal, ema9, ema21, ema50 } = indicators;

  const lines: string[] = [];

  lines.push(`Market Analysis: ${symbol}`);
  lines.push("");

  // Trend assessment
  if (ema9 && ema21 && ema50) {
    if (ema9 > ema21 && ema21 > ema50) {
      lines.push(
        "EMA alignment is bullish (9>21>50), indicating upward price structure across all timeframes."
      );
    } else if (ema9 < ema21 && ema21 < ema50) {
      lines.push(
        "EMA alignment is bearish (9<21<50), indicating downward price structure across all timeframes."
      );
    } else {
      lines.push("EMA alignment is mixed, suggesting a transition phase or sideways conditions.");
    }
  }

  // RSI assessment
  if (rsi !== null) {
    if (rsi > 70) {
      lines.push(
        `RSI at ${rsi.toFixed(1)} is in overbought territory — upward momentum may be exhausting.`
      );
    } else if (rsi < 30) {
      lines.push(
        `RSI at ${rsi.toFixed(1)} is in oversold territory — selling pressure may be nearing exhaustion.`
      );
    } else {
      lines.push(`RSI at ${rsi.toFixed(1)} remains in neutral zone — no extreme momentum.`);
    }
  }

  // MACD assessment
  if (macdLine !== null && macdSignal !== null) {
    if (macdLine > macdSignal) {
      lines.push("MACD histogram is positive, supporting bullish momentum in the short term.");
    } else {
      lines.push("MACD histogram is negative, suggesting slowing momentum and bearish pressure.");
    }
  }

  lines.push("");
  lines.push(`Overall Market State: ${signals.marketState}`);
  lines.push(`Confidence: ${signals.confidence}%`);
  lines.push(`Risk Level: ${signals.riskLevel}`);

  if (signals.noTradeZone) {
    lines.push("");
    lines.push(
      "Market conditions are unclear — conflicting signals present. Avoid directional bias until conditions clarify."
    );
  }

  return lines.join("\n");
}

function ruleBasedAnalysis(
  symbol: string,
  indicators: IndicatorSet,
  signals: SignalResult
): AnalysisResult {
  const cond = detectMarketCondition(indicators);
  const allSignals: string[] = [...signals.supportingSignals];
  const warnings: string[] = [...signals.conflictingSignals];

  if (cond.spikeDetected) warnings.push("High volatility spike detected — dangerous entry conditions");
  if (cond.reversalWarning) warnings.push("Reversal warning — monitor closely for direction change");
  if (signals.noTradeZone)
    warnings.push("No-trade zone — confidence too low for reliable directional prediction");

  const rise = signals.noTradeZone
    ? 50
    : Math.round(signals.bullishScore);
  const fall = 100 - rise;

  return {
    reasoning: buildRuleBasedReasoning(symbol, indicators, signals),
    riseProbability: rise,
    fallProbability: fall,
    confidence: signals.confidence,
    marketCondition: cond.marketCondition,
    marketState: signals.marketState,
    riskLevel: signals.riskLevel,
    bullishScore: signals.bullishScore,
    bearishScore: signals.bearishScore,
    noTradeZone: signals.noTradeZone,
    signals: allSignals,
    warnings,
    aiModel: null,
    cached: false,
  };
}

export async function generateAnalysis(
  symbol: string,
  indicators: IndicatorSet,
  memoryContext = "",
  forceRefresh = false
): Promise<AnalysisResult> {
  const cacheKey = symbol;
  const cached = analysisCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  const signals = mergeSignals(indicators);
  const cond = detectMarketCondition(indicators);

  const aiStatus = await checkAiOnline();
  if (!aiStatus.online) {
    logger.info({ symbol }, "AI offline — using enhanced rule-based analysis");
    const result = ruleBasedAnalysis(symbol, indicators, signals);
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }

  try {
    const prompt = buildPrompt(symbol, indicators, signals, memoryContext);
    const raw = await queryAi(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      reasoning?: string;
      rise_probability?: number;
      fall_probability?: number;
      confidence?: number;
      signals?: string[];
      warnings?: string[];
    };

    const rise = signals.noTradeZone
      ? 50
      : Math.min(Math.max(parsed.rise_probability ?? signals.bullishScore, 0), 100);
    const fall = 100 - rise;
    const aiConfidence = signals.noTradeZone
      ? Math.min(parsed.confidence ?? signals.confidence, 38)
      : Math.min(Math.max(parsed.confidence ?? signals.confidence, 0), 100);

    const result: AnalysisResult = {
      reasoning: parsed.reasoning ?? buildRuleBasedReasoning(symbol, indicators, signals),
      riseProbability: rise,
      fallProbability: fall,
      confidence: aiConfidence,
      marketCondition: cond.marketCondition,
      marketState: signals.marketState,
      riskLevel: signals.riskLevel,
      bullishScore: signals.bullishScore,
      bearishScore: signals.bearishScore,
      noTradeZone: signals.noTradeZone,
      signals: [
        ...(parsed.signals ?? []),
        ...signals.supportingSignals.filter((s) => !(parsed.signals ?? []).includes(s)),
      ].slice(0, 6),
      warnings: [
        ...(parsed.warnings ?? []),
        ...signals.conflictingSignals.filter((s) => !(parsed.warnings ?? []).includes(s)),
      ].slice(0, 4),
      aiModel: aiStatus.model,
      cached: false,
    };

    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  } catch (err) {
    logger.warn({ err, symbol }, "AI query failed — falling back to rule-based");
    const result = ruleBasedAnalysis(symbol, indicators, signals);
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }
}
