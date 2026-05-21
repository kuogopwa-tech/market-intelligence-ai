import { Router } from "express";
import { db } from "@workspace/db";
import { aiAnalysisTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getCandles } from "../lib/derivWs";
import { calculateAllIndicators } from "../lib/indicators";
import { generateAnalysis } from "../lib/aiService";
import { learningMemoryTable } from "@workspace/db";
import { GenerateAnalysisBody } from "@workspace/api-zod";

const router = Router();

async function getMemoryContext(symbol: string): Promise<string> {
  try {
    const memories = await db
      .select()
      .from(learningMemoryTable)
      .where(eq(learningMemoryTable.symbol, symbol))
      .orderBy(desc(learningMemoryTable.createdAt))
      .limit(5);

    if (memories.length === 0) return "";
    return memories
      .map((m) => `Pattern: ${m.patternType} → Outcome: ${m.outcome}${m.accuracy !== null ? ` (${m.accuracy.toFixed(0)}% accuracy)` : ""}`)
      .join("\n");
  } catch {
    return "";
  }
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
        createdAt: latest[0] ? Math.floor(latest[0].createdAt.getTime() / 1000) : Math.floor(Date.now() / 1000),
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
    const row = rows[0];
    res.json({
      id: row.id,
      symbol: row.symbol,
      reasoning: row.reasoning,
      riseProbability: row.riseProbability,
      fallProbability: row.fallProbability,
      confidence: row.confidence,
      marketCondition: row.marketCondition,
      signals: row.signals as string[],
      warnings: row.warnings as string[],
      aiModel: row.aiModel,
      cached: false,
      createdAt: Math.floor(row.createdAt.getTime() / 1000),
    });
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

    res.json(
      rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        reasoning: r.reasoning,
        riseProbability: r.riseProbability,
        fallProbability: r.fallProbability,
        confidence: r.confidence,
        marketCondition: r.marketCondition,
        signals: r.signals as string[],
        warnings: r.warnings as string[],
        aiModel: r.aiModel,
        cached: false,
        createdAt: Math.floor(r.createdAt.getTime() / 1000),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get analysis history");
    res.status(500).json({ error: "Failed to get analysis history" });
  }
});

export default router;
