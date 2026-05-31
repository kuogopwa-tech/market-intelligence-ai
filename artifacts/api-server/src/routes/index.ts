import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import indicatorsRouter from "./indicators";
import analysisRouter from "./analysis";
import predictionsRouter from "./predictions";
import memoryRouter from "./memory";
import aiRouter from "./ai";
import scannerRouter from "./scanner";
import analyticsRouter from "./analytics";
import intelligenceRouter from "./intelligence";

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

export default router;
