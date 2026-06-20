import { logger } from "./logger.js";
import type { IndicatorSet } from "./indicators.js";
import { detectMarketCondition } from "./indicators.js";
import { mergeSignals, type SignalResult } from "./signalEngine.js";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const CACHE_TTL_MS = 5 * 60 * 1000;
const AI_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 500;

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY;
  const isPlaceholder = !key || 
    key === "your_gemini_api_key_here" || 
    key === "your-key" || 
    key === "example" || 
    key === "empty";

  if (isPlaceholder) {
    return null;
  }
  
  return key;
}

function getAiModel() {
  return process.env.AI_MODEL ?? "gemini-2.0-flash";
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const key = getGeminiApiKey();
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

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

export function getAnalysisCacheStats() {
  return { size: analysisCache.size };
}

export function clearAnalysisCache(): void {
  analysisCache.clear();
}

export async function checkAiOnline(): Promise<{
  online: boolean;
  model: string | null;
  provider: string | null;
  responseTimeMs: number | null;
  error: string | null;
}> {
  const start = Date.now();
  const aiModel = getAiModel();
  try {
    const client = getGeminiClient();
    if (!client) {
      return {
        online: false,
        model: aiModel,
        provider: "gemini",
        responseTimeMs: null,
        error: "Invalid or missing API key",
      };
    }
    const model = client.getGenerativeModel({ model: aiModel });

    // Perform a lightweight health check with countTokens
    await model.countTokens("health-check");

    return {
      online: true,
      model: aiModel,
      provider: "gemini",
      responseTimeMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ provider: "gemini", error: errorMsg }, "Gemini health check failed");
    return {
      online: false,
      model: aiModel,
      provider: "gemini",
      responseTimeMs: null,
      error: errorMsg,
    };
  }
}

async function queryAi(prompt: string): Promise<string> {
  let lastError: Error | null = null;
  let retryDelay = INITIAL_RETRY_DELAY_MS;
  const aiModel = getAiModel();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    try {
      const client = getGeminiClient();
      if (!client) throw new Error("GEMINI_API_KEY is not configured correctly");
      
      const model = client.getGenerativeModel({
        model: aiModel,
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 500,
          topP: 0.9,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      });

      // Create abort controller with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      try {
        const response = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) => {
            if (controller.signal.aborted) {
              reject(new Error("Request timeout"));
            }
            controller.signal.addEventListener("abort", () => {
              reject(new Error("Request timeout"));
            });
          }),
        ]);

        clearTimeout(timeout);

        const latencyMs = Date.now() - startTime;
        logger.info(
          { model: aiModel, latencyMs, attempt, provider: "gemini" },
          "Gemini request succeeded"
        );

        const textContent = response.response.text();
        return textContent;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const latencyMs = Date.now() - startTime;

      if (attempt < MAX_RETRIES) {
        logger.warn(
          {
            model: aiModel,
            attempt,
            maxRetries: MAX_RETRIES,
            latencyMs,
            error: lastError.message,
            provider: "gemini",
          },
          `Gemini request failed, retrying in ${retryDelay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      } else {
        logger.error(
          {
            model: aiModel,
            attempt,
            maxRetries: MAX_RETRIES,
            latencyMs,
            error: lastError.message,
            provider: "gemini",
          },
          "Gemini request failed after all retries"
        );
      }
    }
  }

  throw lastError || new Error("Unknown error querying Gemini API");
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
No-Trade Zone: ${signals.noTradeZone ? "YES â€” signals too conflicting" : "No"}

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

RETURN FORMAT (JSON ONLY):
Return ONLY valid JSON with exactly these keys. Do NOT include markdown, backticks, explanations, or any other text.

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
- Be direct and analytical
- No markdown
- No backticks
- No explanation
- Output must be a single JSON object only`;
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
        `RSI at ${rsi.toFixed(1)} is in overbought territory â€” upward momentum may be exhausting.`
      );
    } else if (rsi < 30) {
      lines.push(
        `RSI at ${rsi.toFixed(1)} is in oversold territory â€” selling pressure may be nearing exhaustion.`
      );
    } else {
      lines.push(`RSI at ${rsi.toFixed(1)} remains in neutral zone â€” no extreme momentum.`);
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
      "Market conditions are unclear â€” conflicting signals present. Avoid directional bias until conditions clarify."
    );
  }

  return lines.join("\n");
}

function safeExtractJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    // remove markdown code fences if present
    .replace(/^```[a-zA-Z0-9_-]*\n?/u, "")
    .replace(/```$/u, "")
    .trim();

  const tryNormalizeParse = (candidate: string): unknown => {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) {
      // handle cases like: [ { ... } ]
      const first = parsed[0];
      return first;
    }
    return parsed;
  };

  // Fast path: direct JSON parse (object or array)
  if (
    (cleaned.startsWith("{") && cleaned.endsWith("}")) ||
    (cleaned.startsWith("[") && cleaned.endsWith("]"))
  ) {
    try {
      return tryNormalizeParse(cleaned);
    } catch {
      // fallthrough
    }
  }

  // Extract first JSON object/array block
  const startObj = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");
  const start = startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr);
  if (start === -1) throw new Error("No JSON in AI response");

  const openCh = cleaned[start];
  const closeCh = openCh === "[" ? "]" : "}";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === openCh) depth++;
    if (ch === closeCh) depth--;

    if (depth === 0) {
      const candidate = cleaned.slice(start, i + 1);
      try {
        return tryNormalizeParse(candidate);
      } catch {
        break;
      }
    }
  }

  // Regex fallback: first JSON object-ish block
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) return tryNormalizeParse(objMatch[0]);

  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) return tryNormalizeParse(arrMatch[0]);

  throw new Error("No JSON in AI response");
}

function ruleBasedAnalysis(
  symbol: string,
  indicators: IndicatorSet,
  signals: SignalResult
): AnalysisResult {
  const cond = detectMarketCondition(indicators);
  const allSignals: string[] = [...signals.supportingSignals];
  const warnings: string[] = [...signals.conflictingSignals];

  if (cond.spikeDetected) warnings.push("High volatility spike detected â€” dangerous entry conditions");
  if (cond.reversalWarning) warnings.push("Reversal warning â€” monitor closely for direction change");
  if (signals.noTradeZone)
    warnings.push("No-trade zone â€” confidence too low for reliable directional prediction");

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
    aiModel: getAiModel(),
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
    logger.info({ symbol }, "AI offline â€” using enhanced rule-based analysis");
    const result = ruleBasedAnalysis(symbol, indicators, signals);
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }

  try {
    const prompt = buildPrompt(symbol, indicators, signals, memoryContext);
    const raw = await queryAi(prompt);

    const extracted = safeExtractJsonObject(raw);
    if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
      throw new Error("No JSON object in AI response");
    }

    const parsed = extracted as {
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
    logger.warn({ err, symbol }, "AI query failed â€” falling back to rule-based");
    const result = ruleBasedAnalysis(symbol, indicators, signals);
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }
}

