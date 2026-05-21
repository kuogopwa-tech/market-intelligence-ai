import { Router } from "express";
import { db } from "@workspace/db";
import { learningMemoryTable } from "@workspace/db";
import { eq, desc, avg, count } from "drizzle-orm";

const router = Router();

router.get("/memory", async (req, res) => {
  const symbol = req.query.symbol ? String(req.query.symbol) : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

  try {
    const query = db.select().from(learningMemoryTable);
    const rows = await (symbol
      ? query.where(eq(learningMemoryTable.symbol, symbol)).orderBy(desc(learningMemoryTable.createdAt)).limit(limit)
      : query.orderBy(desc(learningMemoryTable.createdAt)).limit(limit));

    res.json(
      rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        patternType: r.patternType,
        patternData: r.patternData as Record<string, unknown>,
        outcome: r.outcome,
        accuracy: r.accuracy,
        createdAt: Math.floor(r.createdAt.getTime() / 1000),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get memory entries");
    res.status(500).json({ error: "Failed to get memory entries" });
  }
});

router.get("/memory/summary", async (req, res) => {
  const symbol = req.query.symbol ? String(req.query.symbol) : undefined;

  try {
    const query = db.select().from(learningMemoryTable);
    const rows = await (symbol
      ? query.where(eq(learningMemoryTable.symbol, symbol)).orderBy(desc(learningMemoryTable.createdAt)).limit(50)
      : query.orderBy(desc(learningMemoryTable.createdAt)).limit(50));

    const totalPatterns = rows.length;
    const withAccuracy = rows.filter((r) => r.accuracy !== null);
    const avgAccuracy =
      withAccuracy.length > 0
        ? parseFloat((withAccuracy.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) / withAccuracy.length).toFixed(1))
        : 0;

    const patternCounts = new Map<string, number>();
    rows.forEach((r) => {
      patternCounts.set(r.patternType, (patternCounts.get(r.patternType) ?? 0) + 1);
    });

    const topPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p, c]) => `${p} (${c} occurrences)`);

    const correctRows = rows.filter((r) => r.outcome === "correct").slice(0, 3);
    const recentLessons = correctRows.map((r) => {
      const data = r.patternData as Record<string, unknown>;
      return `${r.symbol}: ${r.patternType} with ${data.direction ?? "unknown"} direction was ${r.outcome}`;
    });

    if (totalPatterns === 0) {
      recentLessons.push("No predictions recorded yet — start tracking to build memory");
    }

    res.json({ totalPatterns, avgAccuracy, topPatterns, recentLessons });
  } catch (err) {
    req.log.error({ err }, "Failed to get memory summary");
    res.status(500).json({ error: "Failed to get memory summary" });
  }
});

export default router;
