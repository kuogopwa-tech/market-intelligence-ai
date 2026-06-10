import { Router } from "express";
import { db } from "@workspace/db";
import { aiAnalysisTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getCandles } from "../lib/derivWs";
import { calculateAllIndicators } from "../lib/indicators";
import { generateAnalysis } from "../lib/aiService";
import { mergeSignals, computeSignalQuality } from "../lib/signalEngine";
import { classifyIndicatorPattern, computePatternStats } from "../lib/patternEngine";
import { learningMemoryTable } from "@workspace/db";
import { GenerateAnalysisBody } from "@workspace/api-zod";

const router: Router = Router();

async function getMemoryContext(symbol: string): Promise<string> {
  try {
    const memories = await db
      .select()
      .from(learningMemoryTable)
      .where(eq(learningMemoryTable.symbol, symbol))
      .orderBy(desc(learningMemoryTable.createdAt))
      .limit(8);

    if (memories.length === 0) return "";
    return memories
      .map(
        (m) =>
          `Pattern: ${m.patternType} → Outcome: ${m.outcome}${m.accuracy !== null ? ` (${m.accuracy.toFixed(0)}% accuracy)` : ""}`
      )
      .join("\n");
  } catch {
    return "";
  }
}

function formatRow(row: typeof aiAnalysisTable.$inferSelect) {
  return {
    id: row.id,
    symbol: row.symbol,
    reasoning: row.reasoning,
    riseProbability: row.riseProbability,
    fallProbability: row.fallProbability,
    confidence: row.confidence,
    marketCondition: row.marketCondition,
    marketState: row.marketState ?? null,
    riskLevel: row.riskLevel ?? null,
    bullishScore: row.bullishScore ?? null,
    bearishScore: row.bearishScore ?? null,
    noTradeZone: row.noTradeZone === 1,
    signals: row.signals as string[],
    warnings: row.warnings as string[],
    aiModel: row.aiModel,
    cached: false,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
  };
}

router.post("/analysis/generate", async (req, res) => {
  const parsed = GenerateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { symbol, forceRefresh } = parsed.data;

  try {
    const candles = await getCandles(symbol, 60, 200);
    if (candles.length < 20) {
      res.status(503).json({ error: "Insufficient market data" });
      return;
    }

    const indicators = calculateAllIndicators(symbol, candles);
    const signals = mergeSignals(indicators);
    const memoryCtx = await getMemoryContext(symbol);
    const result = await generateAnalysis(symbol, indicators, memoryCtx, forceRefresh ?? false);

    if (!result.cached) {
      const [saved] = await db
        .insert(aiAnalysisTable)
        .values({
          symbol,
          reasoning: result.reasoning,
          riseProbability: result.riseProbability,
          fallProbability: result.fallProbability,
          confidence: result.confidence,
          marketCondition: result.marketCondition,
          marketState: result.marketState,
          riskLevel: result.riskLevel,
          bullishScore: result.bullishScore,
          bearishScore: result.bearishScore,
          noTradeZone: result.noTradeZone ? 1 : 0,
          signals: result.signals,
          warnings: result.warnings,
          aiModel: result.aiModel,
          cached: 0,
        })
        .returning();

      res.json({
        id: saved.id,
        symbol,
        ...result,
        marketState: signals.marketState,
        riskLevel: signals.riskLevel,
        bullishScore: signals.bullishScore,
        bearishScore: signals.bearishScore,
        noTradeZone: signals.noTradeZone,
        createdAt: Math.floor(saved.createdAt.getTime() / 1000),
      });
    } else {
      const latest = await db
        .select()
        .from(aiAnalysisTable)
        .where(eq(aiAnalysisTable.symbol, symbol))
        .orderBy(desc(aiAnalysisTable.createdAt))
        .limit(1);

      res.json({
        id: latest[0]?.id ?? 0,
        symbol,
        ...result,
        marketState: signals.marketState,
        riskLevel: signals.riskLevel,
        bullishScore: signals.bullishScore,
        bearishScore: signals.bearishScore,
        noTradeZone: signals.noTradeZone,
        createdAt: latest[0]
          ? Math.floor(latest[0].createdAt.getTime() / 1000)
          : Math.floor(Date.now() / 1000),
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to generate analysis");
    res.status(500).json({ error: "Failed to generate analysis" });
  }
});

router.get("/analysis/latest", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");
  try {
    const rows = await db
      .select()
      .from(aiAnalysisTable)
      .where(eq(aiAnalysisTable.symbol, symbol))
      .orderBy(desc(aiAnalysisTable.createdAt))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "No analysis found" });
      return;
    }
    res.json(formatRow(rows[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to get latest analysis");
    res.status(500).json({ error: "Failed to get analysis" });
  }
});

router.get("/analysis/history", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

  try {
    const rows = await db
      .select()
      .from(aiAnalysisTable)
      .where(eq(aiAnalysisTable.symbol, symbol))
      .orderBy(desc(aiAnalysisTable.createdAt))
      .limit(limit);

    res.json(rows.map(formatRow));
  } catch (err) {
    req.log.error({ err }, "Failed to get analysis history");
    res.status(500).json({ error: "Failed to get analysis history" });
  }
});

router.get("/analysis/quality", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");
  const granularity = parseInt(String(req.query.granularity ?? "60"), 10);

  try {
    const candles = await getCandles(symbol, granularity, 200);
    if (candles.length < 20) {
      res.status(503).json({ error: "Insufficient market data" });
      return;
    }

    const indicators = calculateAllIndicators(symbol, candles);
    const signals = mergeSignals(indicators);
    const pattern = classifyIndicatorPattern(indicators);

    // Cross-reference pattern history from learning memory
    const memRows = await db
      .select()
      .from(learningMemoryTable)
      .where(eq(learningMemoryTable.symbol, symbol))
      .orderBy(desc(learningMemoryTable.createdAt))
      .limit(100);

    const patternMems = memRows.map((r) => ({
      patternType: r.patternType,
      outcome: r.outcome,
      accuracy: r.accuracy,
      patternData: r.patternData,
      symbol: r.symbol,
    }));
    const patternStats = computePatternStats(patternMems);
    const currentPatternStat = patternStats.find((s) => s.pattern === pattern.name);

    const quality = computeSignalQuality(
      signals,
      indicators,
      currentPatternStat
        ? { successRate: currentPatternStat.successRate, totalTrades: currentPatternStat.totalTrades }
        : undefined
    );

    res.json({
      symbol,
      // Signal data
      bullishScore: signals.bullishScore,
      bearishScore: signals.bearishScore,
      confidence: signals.confidence,
      marketState: signals.marketState,
      riskLevel: signals.riskLevel,
      noTradeZone: signals.noTradeZone,
      supportingSignals: signals.supportingSignals,
      conflictingSignals: signals.conflictingSignals,
      // Quality data
      cleanSignalScore: quality.cleanSignalScore,
      riskScore: quality.riskScore,
      confidenceWeight: quality.confidenceWeight,
      indicatorAlignment: quality.indicatorAlignment,
      momentumConfirmation: quality.momentumConfirmation,
      volatilityCompatibility: quality.volatilityCompatibility,
      marketCleanliness: quality.marketCleanliness,
      setupRarity: quality.setupRarity,
      alertType: quality.alertType,
      expirySeconds: quality.expirySeconds,
      historicalBoost: quality.historicalBoost,
      // Pattern context
      patternName: pattern.name,
      historicalSuccessRate: currentPatternStat?.successRate ?? 0,
      historicalTrades: currentPatternStat?.totalTrades ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get signal quality");
    res.status(500).json({ error: "Failed to compute signal quality" });
  }
});

router.get("/analysis/signals", async (req, res) => {
  const symbol = String(req.query.symbol ?? "R_100");
  const granularity = parseInt(String(req.query.granularity ?? "60"), 10);

  try {
    const candles = await getCandles(symbol, granularity, 200);
    if (candles.length < 20) {
      res.status(503).json({ error: "Insufficient market data" });
      return;
    }

    const indicators = calculateAllIndicators(symbol, candles);
    const signals = mergeSignals(indicators);

    res.json({
      symbol,
      bullishScore: signals.bullishScore,
      bearishScore: signals.bearishScore,
      neutralScore: signals.neutralScore,
      confidence: signals.confidence,
      riskLevel: signals.riskLevel,
      marketState: signals.marketState,
      supportingSignals: signals.supportingSignals,
      conflictingSignals: signals.conflictingSignals,
      noTradeZone: signals.noTradeZone,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get signal analysis");
    res.status(500).json({ error: "Failed to compute signals" });
  }
});

export default router;
