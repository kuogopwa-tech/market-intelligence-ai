/**
 * system.ts
 *
 * Backend-only system management endpoints.
 * Handles system-wide operations like full AI system reset.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  learningMemoryTable,
  predictionsTable,
  aiAnalysisTable,
  intelligenceSnapshotsTable,
  scanRunsTable,
  hourlySummariesTable,
  dailySummariesTable,
  symbolTimelineTable,
  indicatorsHistoryTable,
} from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { setSystemResetFlag, isSystemReset, stopBackgroundScanner, startBackgroundScanner } from "../lib/backgroundScanner.js";

const router: Router = Router();

/**
 * POST /system/reset-all
 *
 * Fully resets ALL AI learning layers:
 * - Memory (learning memory, patterns, lessons, personality snapshots)
 * - Predictions (all predictions and accuracy tracking)
 * - AI Analysis (all analysis results)
 * - Intelligence (snapshots, summaries, scan history)
 * - Analytics (timeline, heatmap, overview cache)
 * - Scanner (scan runs)
 * - Symbol Learning (timeline, pattern recognition)
 *
 * Body: { symbol?: string, confirm: true }
 *
 * If symbol is provided, only resets data for that symbol.
 * If confirm is not true, returns 400 error.
 */
router.post("/system/reset-all", async (req, res) => {
  try {
    const { symbol, confirm } = req.body;

    // Require explicit confirmation
    if (confirm !== true) {
      res.status(400).json({
        success: false,
        error: "Confirmation required. Set confirm: true to proceed.",
      });
      return;
    }

    const symbolFilter = symbol ? String(symbol) : null;
    const wiped: string[] = [];

    // Set system reset flag to prevent immediate re-learning
    setSystemResetFlag(true, symbolFilter);
    wiped.push("backgroundScanner_paused");

    try {
      // Use a transaction for safety
      await db.transaction(async (tx) => {
        if (symbolFilter) {
          // === Symbol-specific reset ===

          // 1. Memory - delete all learning memory for this symbol
          await tx
            .delete(learningMemoryTable)
            .where(eq(learningMemoryTable.symbol, symbolFilter));
          wiped.push("memory");

          // 2. Predictions - delete all predictions for this symbol
          await tx
            .delete(predictionsTable)
            .where(eq(predictionsTable.symbol, symbolFilter));
          wiped.push("predictions");

          // 3. AI Analysis - delete all analysis for this symbol
          await tx
            .delete(aiAnalysisTable)
            .where(eq(aiAnalysisTable.symbol, symbolFilter));
          wiped.push("aiAnalysis");

          // 4. Intelligence Snapshots - delete all snapshots for this symbol
          await tx
            .delete(intelligenceSnapshotsTable)
            .where(eq(intelligenceSnapshotsTable.symbol, symbolFilter));
          wiped.push("intelligence_snapshots");

          // 5. Hourly Summaries - delete hourly summaries for this symbol
          await tx
            .delete(hourlySummariesTable)
            .where(eq(hourlySummariesTable.symbol, symbolFilter));
          wiped.push("hourlySummaries");

          // 6. Daily Summaries - delete daily summaries for this symbol
          await tx
            .delete(dailySummariesTable)
            .where(eq(dailySummariesTable.symbol, symbolFilter));
          wiped.push("dailySummaries");

          // 7. Symbol Timeline - delete timeline entries for this symbol
          await tx
            .delete(symbolTimelineTable)
            .where(eq(symbolTimelineTable.symbol, symbolFilter));
          wiped.push("symbolTimeline");

          // 8. Indicators History - delete indicator history for this symbol
          await tx
            .delete(indicatorsHistoryTable)
            .where(eq(indicatorsHistoryTable.symbol, symbolFilter));
          wiped.push("indicatorsHistory");

          // 9. Scan Runs - these are global, but we don't delete them for symbol-specific resets
        } else {
          // === Full system reset (all symbols) ===

          // 1. Memory - delete all learning memory
          await tx.delete(learningMemoryTable);
          wiped.push("memory");

          // 2. Predictions - delete all predictions
          await tx.delete(predictionsTable);
          wiped.push("predictions");

          // 3. AI Analysis - delete all analysis
          await tx.delete(aiAnalysisTable);
          wiped.push("aiAnalysis");

          // 4. Intelligence Snapshots - delete all snapshots
          await tx.delete(intelligenceSnapshotsTable);
          wiped.push("intelligence_snapshots");

          // 5. Scan Runs - delete all scan history
          await tx.delete(scanRunsTable);
          wiped.push("scanRuns");

          // 6. Hourly Summaries - delete all hourly summaries
          await tx.delete(hourlySummariesTable);
          wiped.push("hourlySummaries");

          // 7. Daily Summaries - delete all daily summaries
          await tx.delete(dailySummariesTable);
          wiped.push("dailySummaries");

          // 8. Symbol Timeline - delete all timeline entries
          await tx.delete(symbolTimelineTable);
          wiped.push("symbolTimeline");

          // 9. Indicators History - delete all indicator history
          await tx.delete(indicatorsHistoryTable);
          wiped.push("indicatorsHistory");
        }
      });

      // Clear the reset flag after a delay to prevent immediate re-learning
      // The flag will be cleared automatically after 30 seconds
      setTimeout(() => {
        setSystemResetFlag(false, symbolFilter);
        req.log.info(
          { symbol: symbolFilter },
          "System reset flag cleared - scanner can resume"
        );
      }, 30000); // 30 second delay

      res.json({
        success: true,
        wiped,
        message: symbolFilter
          ? `AI system reset for symbol: ${symbolFilter}`
          : "AI system fully reset",
        symbol: symbolFilter,
        resetAt: Math.floor(Date.now() / 1000),
        scannerResumeIn: 30,
      });
    } catch (err) {
      // Clear the reset flag on error
      setSystemResetFlag(false, symbolFilter);
      throw err;
    }
  } catch (err) {
    req.log.error({ err }, "System reset failed");
    res.status(500).json({ success: false, error: "System reset failed" });
  }
});

/**
 * GET /system/status
 *
 * Returns current system status including reset state.
 */
router.get("/system/status", async (_req, res) => {
  try {
    const resetState = isSystemReset();

    res.json({
      systemReset: resetState.active,
      resetSymbol: resetState.symbol,
      resetAt: resetState.resetAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get system status" });
  }
});

export default router;
