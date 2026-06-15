import { Router, type IRouter } from "express";
import { db, predictionsTable, learningMemoryTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router: IRouter = Router();

// Protected reset endpoint for development/deployment resets
router.post("/dev/reset", requireAuth(), requireAdmin(), async (req, res) => {
  try {
    logger.info("Starting development data reset...");

    // Delete all rows from predictionsTable
    const deletedPredictions = await db.delete(predictionsTable).returning({ id: predictionsTable.id });
    
    // Delete all rows from learningMemoryTable
    const deletedMemory = await db.delete(learningMemoryTable).returning({ id: learningMemoryTable.id });

    logger.info({
      predictionsDeleted: deletedPredictions.length,
      memoryDeleted: deletedMemory.length
    }, "Development data reset successful");

    res.json({
      success: true,
      message: "Development data reset successfully",
      counts: {
        predictions: deletedPredictions.length,
        learningMemory: deletedMemory.length
      }
    });
  } catch (err) {
    logger.error({ err }, "Failed to reset development data");
    res.status(500).json({ error: "Failed to reset development data" });
  }
});

export default router;
