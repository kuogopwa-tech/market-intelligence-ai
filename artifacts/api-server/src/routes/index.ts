import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketRouter from "./market";
import indicatorsRouter from "./indicators";
import analysisRouter from "./analysis";
import predictionsRouter from "./predictions";
import memoryRouter from "./memory";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketRouter);
router.use(indicatorsRouter);
router.use(analysisRouter);
router.use(predictionsRouter);
router.use(memoryRouter);
router.use(aiRouter);

export default router;
