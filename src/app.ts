import compression from "compression";
import cors, { type CorsOptions } from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { env } from "./config/env.config.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { apiRouter } from "./router/index.js";

const parseCorsOrigin = (value: string): CorsOptions["origin"] => {
  if (value === "*") {
    return true;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const createApp = (): express.Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: parseCorsOrigin(env.CORS_ORIGIN),
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(express.urlencoded({ extended: true }));
  app.use(
    rateLimit({
      legacyHeaders: false,
      limit: 100,
      standardHeaders: "draft-8",
      windowMs: 15 * 60 * 1000,
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: "john-karle-backend",
        status: "ok",
      },
    });
  });

  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: "john-karle-backend",
        status: "ok",
      },
    });
  });

  app.get("/api/v1", apiRouter);

  app.use("/api/auth", authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
