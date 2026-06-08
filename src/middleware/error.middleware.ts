import type { ErrorRequestHandler, RequestHandler } from "express";
// import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";

import { env } from "../config/env.config.js";
import { ApiError } from "../utils/api-error.util.js";
import { logger } from "../utils/logger.util.js";

type MongoDuplicateKeyError = Error & {
  code?: number;
  keyValue?: Record<string, unknown>;
};

const isDuplicateKeyError = (error: unknown): error is MongoDuplicateKeyError =>
  error instanceof Error && "code" in error && (error as MongoDuplicateKeyError).code === 11000;

const normalizeError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ApiError(400, "Request validation failed.", "VALIDATION_ERROR", error.issues);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new ApiError(400, "Database validation failed.", "DATABASE_VALIDATION_ERROR");
  }

  if (error instanceof multer.MulterError) {
    return new ApiError(400, error.message, "FILE_UPLOAD_ERROR");
  }

  if (isDuplicateKeyError(error)) {
    return new ApiError(409, "Resource already exists.", "DUPLICATE_RESOURCE", error.keyValue);
  }

  // if (error instanceof TokenExpiredError) {
  //   return new ApiError(401, "Token has expired.", "TOKEN_EXPIRED");
  // }

  // if (error instanceof JsonWebTokenError) {
  //   return new ApiError(401, "Token is invalid.", "INVALID_TOKEN");
  // }

  return new ApiError(500, "Internal server error.", "INTERNAL_SERVER_ERROR");
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found.`, "ROUTE_NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const apiError = normalizeError(error);

  if (apiError.statusCode >= 500) {
    logger.error({ err: error, method: req.method, path: req.originalUrl }, apiError.message);
  }

  res.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
      ...(env.NODE_ENV === "development" ? { stack: apiError.stack } : {}),
    },
  });
};
