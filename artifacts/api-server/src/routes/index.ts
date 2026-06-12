import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import marketRouter from "./market.js";
import indicatorsRouter from "./indicators.js";
import analysisRouter from "./analysis.js";
import predictionsRouter from "./predictions.js";
import memoryRouter from "./memory.js";
import aiRouter from "./ai.js";
import scannerRouter from "./scanner.js";
import analyticsRouter from "./analytics.js";
import intelligenceRouter from "./intelligence.js";
import devRouter from "./dev.js";
import authRouter from "./auth.js";
import systemRouter from "./system.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(indicatorsRouter);
router.use(analysisRouter);
router.use(predictionsRouter);
router.use(memoryRouter);
router.use(aiRouter);
router.use(scannerRouter);
router.use(analyticsRouter);
router.use(intelligenceRouter);
router.use(devRouter);
router.use("/auth", authRouter);
router.use(systemRouter);
router.use(adminRouter);

export default router;
