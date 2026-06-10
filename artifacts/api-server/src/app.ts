import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import { authenticate } from "./middleware/auth.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth middleware remains global
app.use(authenticate);

// Lazy-load /api router to avoid initializing DB/Gemini at module import time.
let apiRouter: any = null;
let apiMounted = false;

app.use((req: Request, res: Response, next: NextFunction) => {
  // Only handle API paths here; let other static handlers pass through
  if (!req.path.startsWith("/api")) return next();

  if (apiMounted && apiRouter) {
    return apiRouter(req, res, next);
  }

  // First API request: dynamically import and mount the router
  import("./routes.js")
    .then((mod) => {
      apiRouter = mod.default;
      // Mount for future requests
      app.use("/api", apiRouter);
      apiMounted = true;
      // Forward this request to the newly mounted router
      return apiRouter(req, res, next);
    })
    .catch((err) => {
      logger.error({ err }, "Failed to load API routes");
      res.status(500).json({ error: "Failed to initialize API routes" });
    });
});

export default app;

