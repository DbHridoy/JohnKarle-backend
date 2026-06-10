import compression from "compression";
import cors, { type CorsOptions } from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env.config.js";
import { swaggerSpec } from "./config/swagger.config.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
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

  // Configure Helmet. Disable CSP so that Swagger UI scripts and styles load successfully.
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

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

  // Serve swagger JSON spec
  app.get(["/docs.json", "/api-docs.json"], (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(["/docs", "/api-docs"], swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

  app.use("/api/v1", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
