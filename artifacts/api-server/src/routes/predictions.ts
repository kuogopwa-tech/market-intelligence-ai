import { Router } from "express";
import { db } from "@workspace/db";
import { predictionsTable, learningMemoryTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { CreatePredictionBody, UpdatePredictionOutcomeBody, UpdatePredictionOutcomeParams } from "@workspace/api-zod";

const router = Router();

router.get("/predictions", async (req, res) => {
  const symbol = req.query.symbol ? String(req.query.symbol) : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

  try {
    const query = db.select().from(predictionsTable);
    const rows = await (symbol
      ? query.where(eq(predictionsTable.symbol, symbol)).orderBy(desc(predictionsTable.createdAt)).limit(limit)
      : query.orderBy(desc(predictionsTable.createdAt)).limit(limit));

    res.json(
      rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        direction: r.direction,
        confidence: r.confidence,
        entryPrice: r.entryPrice,
        exitPrice: r.exitPrice,
        outcome: r.outcome,
        analysisId: r.analysisId,
        indicators: r.indicators as Record<string, unknown>,
        resolvedAt: r.resolvedAt,
        createdAt: Math.floor(r.createdAt.getTime() / 1000),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get predictions");
    res.status(500).json({ error: "Failed to get predictions" });
  }
});

router.post("/predictions", async (req, res) => {
  const parsed = CreatePredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { symbol, direction, confidence, entryPrice, analysisId, indicators } = parsed.data;

  try {
    const [row] = await db
      .insert(predictionsTable)
      .values({
        symbol,
        direction,
        confidence,
        entryPrice,
        analysisId: analysisId ?? null,
        indicators: indicators as Record<string, unknown>,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      symbol: row.symbol,
      direction: row.direction,
      confidence: row.confidence,
      entryPrice: row.entryPrice,
      exitPrice: row.exitPrice,
      outcome: row.outcome,
      analysisId: row.analysisId,
      indicators: row.indicators as Record<string, unknown>,
      resolvedAt: row.resolvedAt,
      createdAt: Math.floor(row.createdAt.getTime() / 1000),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create prediction");
    res.status(500).json({ error: "Failed to create prediction" });
  }
});

router.patch("/predictions/:id/outcome", async (req, res) => {
  const paramsResult = UpdatePredictionOutcomeParams.safeParse({ id: parseInt(req.params.id, 10) });
  const bodyResult = UpdatePredictionOutcomeBody.safeParse(req.body);

  if (!paramsResult.success || !bodyResult.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { id } = paramsResult.data;
  const { outcome, exitPrice } = bodyResult.data;

  try {
    const existing = await db.select().from(predictionsTable).where(eq(predictionsTable.id, id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Prediction not found" });
      return;
    }

    const [updated] = await db
      .update(predictionsTable)
      .set({ outcome, exitPrice, resolvedAt: Math.floor(Date.now() / 1000) })
      .where(eq(predictionsTable.id, id))
      .returning();

    const pred = existing[0];
    await db.insert(learningMemoryTable).values({
      symbol: pred.symbol,
      patternType: "prediction_outcome",
      patternData: { direction: pred.direction, confidence: pred.confidence, indicators: pred.indicators },
      outcome,
      accuracy: outcome === "correct" ? pred.confidence : 100 - pred.confidence,
    });

    res.json({
      id: updated.id,
      symbol: updated.symbol,
      direction: updated.direction,
      confidence: updated.confidence,
      entryPrice: updated.entryPrice,
      exitPrice: updated.exitPrice,
      outcome: updated.outcome,
      analysisId: updated.analysisId,
      indicators: updated.indicators as Record<string, unknown>,
      resolvedAt: updated.resolvedAt,
      createdAt: Math.floor(updated.createdAt.getTime() / 1000),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update prediction outcome");
    res.status(500).json({ error: "Failed to update outcome" });
  }
});

router.get("/predictions/accuracy", async (req, res) => {
  try {
    const rows = await db
      .select({
        symbol: predictionsTable.symbol,
        total: sql<number>`count(*)::int`,
        correct: sql<number>`count(*) filter (where ${predictionsTable.outcome} = 'correct')::int`,
        incorrect: sql<number>`count(*) filter (where ${predictionsTable.outcome} = 'incorrect')::int`,
        pending: sql<number>`count(*) filter (where ${predictionsTable.outcome} is null)::int`,
      })
      .from(predictionsTable)
      .groupBy(predictionsTable.symbol);

    res.json(
      rows.map((r) => ({
        symbol: r.symbol,
        total: r.total,
        correct: r.correct,
        incorrect: r.incorrect,
        pending: r.pending,
        accuracy: r.total > 0 ? parseFloat(((r.correct / (r.correct + r.incorrect || 1)) * 100).toFixed(1)) : 0,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get accuracy stats");
    res.status(500).json({ error: "Failed to get accuracy stats" });
  }
});

export default router;
