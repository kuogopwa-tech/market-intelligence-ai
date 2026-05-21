import { logger } from "./logger";
import type { IndicatorSet } from "./indicators";
import { detectMarketCondition } from "./indicators";

const AI_BASE_URL = process.env.AI_BASE_URL ?? "http://localhost:11434";
const AI_MODEL = process.env.AI_MODEL ?? "qwen2.5:3b";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface AnalysisResult {
  reasoning: string;
  riseProbability: number;
  fallProbability: number;
  confidence: number;
  marketCondition: string;
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

async function checkAiOnline(): Promise<{ online: boolean; model: string | null; provider: string | null; responseTimeMs: number | null; error: string | null }> {
  const start = Date.now();
  try {
    const res = await fetch(`${AI_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { models?: { name: string }[] };
    const model = data.models?.[0]?.name ?? AI_MODEL;
    return { online: true, model, provider: "ollama", responseTimeMs: Date.now() - start, error: null };
  } catch {
    try {
      const res2 = await fetch(`${AI_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      return { online: true, model: AI_MODEL, provider: "llama.cpp", responseTimeMs: Date.now() - start, error: null };
    } catch (err2) {
      return { online: false, model: null, provider: null, responseTimeMs: null, error: String(err2) };
    }
  }
}

async function queryAi(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${AI_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, prompt, stream: false, options: { temperature: 0.3, num_predict: 400 } }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return data.response ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(symbol: string, indicators: IndicatorSet, memoryContext: string): string {
  const { rsi, macdLine, macdSignal, ema9, ema21, ema50, atr, stochasticK, bollingerUpper, bollingerLower, bollingerMiddle, trendStrength } = indicators;
  const cond = detectMarketCondition(indicators);
  return `You are an expert market analyst for ${symbol} (${cond.marketCondition} market, ${cond.trend} trend).

Current Technical Indicators:
- RSI(14): ${rsi?.toFixed(2) ?? "N/A"} (${rsi !== null ? (rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral") : "N/A"})
- MACD Line: ${macdLine?.toFixed(5) ?? "N/A"}, Signal: ${macdSignal?.toFixed(5) ?? "N/A"}
- EMA 9: ${ema9?.toFixed(5) ?? "N/A"}, EMA 21: ${ema21?.toFixed(5) ?? "N/A"}, EMA 50: ${ema50?.toFixed(5) ?? "N/A"}
- Stochastic K: ${stochasticK?.toFixed(2) ?? "N/A"}
- Bollinger: Upper=${bollingerUpper?.toFixed(5) ?? "N/A"}, Mid=${bollingerMiddle?.toFixed(5) ?? "N/A"}, Lower=${bollingerLower?.toFixed(5) ?? "N/A"}
- ATR: ${atr?.toFixed(5) ?? "N/A"}
- Trend Strength: ${trendStrength?.toFixed(2) ?? "N/A"}%
- Momentum: ${cond.momentum}, Volatility: ${cond.volatility}
${memoryContext ? `\nPrevious Pattern Memory:\n${memoryContext}` : ""}

Analyze the market and respond ONLY in this exact JSON format (no extra text):
{
  "reasoning": "2-3 sentence explanation of market conditions and what may happen next",
  "rise_probability": <0-100 integer>,
  "fall_probability": <0-100 integer>,
  "confidence": <0-100 integer>,
  "signals": ["signal1", "signal2"],
  "warnings": ["warning1"]
}

Rules: rise_probability + fall_probability must equal 100. Be specific about indicator conflicts. Mention overbought/oversold conditions. Keep reasoning under 150 words.`;
}

function ruleBasedAnalysis(symbol: string, indicators: IndicatorSet): AnalysisResult {
  const { rsi, macdLine, macdSignal, ema9, ema21, ema50, stochasticK } = indicators;
  const cond = detectMarketCondition(indicators);
  const signals: string[] = [];
  const warnings: string[] = [];
  let bullishScore = 50;

  if (rsi !== null) {
    if (rsi > 70) { bullishScore -= 15; warnings.push("RSI overbought — potential reversal risk"); }
    else if (rsi < 30) { bullishScore += 15; warnings.push("RSI oversold — potential bounce zone"); }
    else if (rsi > 55) { bullishScore += 8; signals.push("RSI bullish momentum"); }
    else if (rsi < 45) { bullishScore -= 8; signals.push("RSI bearish momentum"); }
  }

  if (macdLine !== null && macdSignal !== null) {
    if (macdLine > macdSignal) { bullishScore += 10; signals.push("MACD bullish crossover"); }
    else { bullishScore -= 10; signals.push("MACD bearish crossover"); }
  }

  if (ema9 !== null && ema21 !== null && ema50 !== null) {
    if (ema9 > ema21 && ema21 > ema50) { bullishScore += 12; signals.push("EMA bullish alignment (9>21>50)"); }
    else if (ema9 < ema21 && ema21 < ema50) { bullishScore -= 12; signals.push("EMA bearish alignment (9<21<50)"); }
    else { warnings.push("EMA alignment mixed — trend unclear"); }
  }

  if (stochasticK !== null) {
    if (stochasticK > 80) { warnings.push("Stochastic overbought zone"); bullishScore -= 5; }
    else if (stochasticK < 20) { warnings.push("Stochastic oversold zone"); bullishScore += 5; }
  }

  if (cond.spikeDetected) warnings.push("High volatility spike detected — dangerous entry");
  if (cond.reversalWarning) warnings.push("Reversal warning — conflicting signals");
  if (cond.marketCondition === "ranging") warnings.push("Ranging market — breakout direction uncertain");

  bullishScore = Math.max(5, Math.min(95, bullishScore));
  const confidence = Math.abs(bullishScore - 50) * 1.5 + 20;

  return {
    reasoning: `${symbol} is in a ${cond.marketCondition} market with ${cond.trend} trend. ${cond.momentum !== "flat" ? `Momentum is ${cond.momentum}.` : "Momentum is flat."} ${warnings.length > 0 ? `Key concern: ${warnings[0]}.` : "No major conflict signals at this time."}`,
    riseProbability: Math.round(bullishScore),
    fallProbability: Math.round(100 - bullishScore),
    confidence: Math.min(Math.round(confidence), 85),
    marketCondition: cond.marketCondition,
    signals,
    warnings,
    aiModel: null,
    cached: false,
  };
}

export { checkAiOnline };

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

  const aiStatus = await checkAiOnline();
  if (!aiStatus.online) {
    logger.info({ symbol }, "AI offline — using rule-based analysis");
    const result = ruleBasedAnalysis(symbol, indicators);
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }

  try {
    const prompt = buildPrompt(symbol, indicators, memoryContext);
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

    const cond = detectMarketCondition(indicators);
    const rise = Math.min(Math.max(parsed.rise_probability ?? 50, 0), 100);
    const fall = 100 - rise;

    const result: AnalysisResult = {
      reasoning: parsed.reasoning ?? "Market analysis in progress.",
      riseProbability: rise,
      fallProbability: fall,
      confidence: Math.min(Math.max(parsed.confidence ?? 50, 0), 100),
      marketCondition: cond.marketCondition,
      signals: parsed.signals ?? [],
      warnings: parsed.warnings ?? [],
      aiModel: aiStatus.model,
      cached: false,
    };

    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  } catch (err) {
    logger.warn({ err, symbol }, "AI query failed — falling back to rule-based");
    const result = ruleBasedAnalysis(symbol, indicators);
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }
}
