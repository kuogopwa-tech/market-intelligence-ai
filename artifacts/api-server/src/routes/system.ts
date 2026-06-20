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
import { eq, sql } from "drizzle-orm";
import {
  setSystemResetFlag,
  isSystemReset,
  stopBackgroundScanner,
  startBackgroundScanner,
  resetBackgroundScannerState,
} from "../lib/backgroundScanner.js";
import { clearAnalysisCache } from "../lib/aiService.js";
import { clearDerivCaches } from "../lib/derivWs.js";
import { clearPredictionRateLimits } from "./predictions.js";
import { clearActiveUserTracking } from "./admin.js";

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
  const beforeCounts: Record<string, number> = {};
  const afterCounts: Record<string, number> = {};
  const cachesCleared: Record<string, { before: number; after: number }> = {};
  const servicesReset: string[] = [];
  let scannerRestarted = false;

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
    const tablesCleared: string[] = [];
    const wiped: string[] = [];

    // Hard stop scanner first to avoid immediate repopulation
    stopBackgroundScanner();
    servicesReset.push("backgroundScanner_stopped");

    // Set system reset flag to prevent immediate re-learning
    setSystemResetFlag(true, symbolFilter);
    servicesReset.push("systemResetFlag_set");

    const safeCount = async (table: any, name: string) => {
      const [row] = await db.select({ count: sql<number>`count(*)` }).from(table);
      beforeCounts[name] = Number(row.count ?? 0);
    };

    if (!symbolFilter) {
      // Full reset: count all AI-learning related tables
      await Promise.all([
        safeCount(aiAnalysisTable, "ai_analysis"),
        safeCount(dailySummariesTable, "daily_summaries"),
        safeCount(hourlySummariesTable, "hourly_summaries"),
        safeCount(intelligenceSnapshotsTable, "intelligence_snapshots"),
        safeCount(learningMemoryTable, "learning_memory"),
        safeCount(predictionsTable, "predictions"),
        safeCount(scanRunsTable, "scan_runs"),
        safeCount(symbolTimelineTable, "symbol_timeline"),
      ]);
    } else {
      // Symbol-specific reset: count relevant subsets
      const countWhere = async (table: any, name: string) => {
        const where = table.symbol ? eq(table.symbol, symbolFilter) : undefined;
        const query = where
          ? db.select({ count: sql<number>`count(*)` }).from(table).where(where as any)
          : db.select({ count: sql<number>`count(*)` }).from(table);
        const [row] = await query;
        beforeCounts[name] = Number(row.count ?? 0);
      };

      await Promise.all([
        countWhere(aiAnalysisTable, "ai_analysis"),
        countWhere(dailySummariesTable, "daily_summaries"),
        countWhere(hourlySummariesTable, "hourly_summaries"),
        countWhere(indicatorsHistoryTable, "indicators_history"),
        countWhere(intelligenceSnapshotsTable, "intelligence_snapshots"),
        countWhere(learningMemoryTable, "learning_memory"),
        countWhere(predictionsTable, "predictions"),
        countWhere(symbolTimelineTable, "symbol_timeline"),
        safeCount(scanRunsTable, "scan_runs"),
      ]);
    }

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
          // === Full intelligence system reset (all symbols) ===
          // HARD RESET using TRUNCATE (NOT DELETE row-by-row) for the required tables.

          // Required tables (per request):
          // - intelligence_snapshots
          // - symbol_timeline
          // - scan_runs
          // - ai_analysis
          // - hourly_summaries
          // - daily_summaries
          // - learning_memory
          // - predictions

          const truncateSql = `
            TRUNCATE TABLE
              intelligence_snapshots,
              symbol_timeline,
              scan_runs,
              ai_analysis,
              hourly_summaries,
              daily_summaries,
              learning_memory,
              predictions
            RESTART IDENTITY
            CASCADE;
          `;

          await tx.execute(sql.raw(truncateSql));

          // Confirmation lists
          tablesCleared.push(
            "intelligence_snapshots",
            "symbol_timeline",
            "scan_runs",
            "ai_analysis",
            "hourly_summaries",
            "daily_summaries",
            "learning_memory",
            "predictions"
          );

          wiped.push("full_truncate_complete");

          // NOTE: per request we do NOT truncate/delete any other tables here.
          // (Users table is untouched; migrations tables are untouched.)
        }
      });

      // Clear in-memory caches/state after DB transaction succeeds
      servicesReset.push("aiService_analysisCache_cleared");
      cachesCleared.analysisCache = { before: 0, after: 0 };
      clearAnalysisCache();

      servicesReset.push("derivWs_caches_cleared");
      cachesCleared.derivWs = { before: 0, after: 0 };
      clearDerivCaches();

      servicesReset.push("predictions_rateLimits_cleared");
      clearPredictionRateLimits();

      servicesReset.push("admin_activeUserTracking_cleared");
      clearActiveUserTracking();

      servicesReset.push("backgroundScanner_state_reset");
      resetBackgroundScannerState(symbolFilter);

      // Compute afterCounts
      const safeCountAfter = async (table: any, name: string) => {
        const [row] = await db.select({ count: sql<number>`count(*)` }).from(table);
        afterCounts[name] = Number(row.count ?? 0);
      };

      if (!symbolFilter) {
        await Promise.all([
          safeCountAfter(aiAnalysisTable, "ai_analysis"),
          safeCountAfter(dailySummariesTable, "daily_summaries"),
          safeCountAfter(hourlySummariesTable, "hourly_summaries"),
          safeCountAfter(intelligenceSnapshotsTable, "intelligence_snapshots"),
          safeCountAfter(learningMemoryTable, "learning_memory"),
          safeCountAfter(predictionsTable, "predictions"),
          safeCountAfter(scanRunsTable, "scan_runs"),
          safeCountAfter(symbolTimelineTable, "symbol_timeline"),
        ]);
      } else {
        const countWhereAfter = async (table: any, name: string) => {
          const where = table.symbol ? eq(table.symbol, symbolFilter) : undefined;
          const query = where
            ? db.select({ count: sql<number>`count(*)` }).from(table).where(where as any)
            : db.select({ count: sql<number>`count(*)` }).from(table);
          const [row] = await query;
          afterCounts[name] = Number(row.count ?? 0);
        };

        await Promise.all([
          countWhereAfter(aiAnalysisTable, "ai_analysis"),
          countWhereAfter(dailySummariesTable, "daily_summaries"),
          countWhereAfter(hourlySummariesTable, "hourly_summaries"),
          countWhereAfter(indicatorsHistoryTable, "indicators_history"),
          countWhereAfter(intelligenceSnapshotsTable, "intelligence_snapshots"),
          countWhereAfter(learningMemoryTable, "learning_memory"),
          countWhereAfter(predictionsTable, "predictions"),
          safeCountAfter(scanRunsTable, "scan_runs"),
          countWhereAfter(symbolTimelineTable, "symbol_timeline"),
        ]);
      }

      // Clear the reset flag and restart scanner immediately
      setSystemResetFlag(false, symbolFilter);
      startBackgroundScanner();
      scannerRestarted = true;

      res.json({
        success: true,
        message: symbolFilter
          ? `AI system reset for symbol: ${symbolFilter}`
          : "AI system fully reset",
        symbol: symbolFilter,
        resetAt: Math.floor(Date.now() / 1000),
        beforeCounts,
        afterCounts,
        tablesCleared,
        cachesCleared,
        servicesReset,
        scannerRestarted,
        preservedData: { users: true },
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
