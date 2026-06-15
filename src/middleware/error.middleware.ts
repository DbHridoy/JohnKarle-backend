import type { ErrorRequestHandler, RequestHandler } from "express";
import jwt from "jsonwebtoken";
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

type MulterFieldError = multer.MulterError & {
  field?: string;
};

type ResponseError = {
  code?: string;
  message: string;
  path?: string;
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

  if (error instanceof mongoose.Error.CastError) {
    return new ApiError(400, `Invalid ${error.path}.`, "INVALID_IDENTIFIER");
  }

  if (error instanceof multer.MulterError) {
    const field = (error as MulterFieldError).field;

    if (error.code === "LIMIT_UNEXPECTED_FILE" && field) {
      return new ApiError(400, `Unexpected file field: ${field}.`, "FILE_UPLOAD_ERROR", { field });
    }

    return new ApiError(400, error.message, "FILE_UPLOAD_ERROR", {
      ...(field ? { field } : {}),
    });
  }

  if (isDuplicateKeyError(error)) {
    return new ApiError(409, "Resource already exists.", "DUPLICATE_RESOURCE", error.keyValue);
  }

  if (error instanceof jwt.TokenExpiredError) {
    return new ApiError(401, "Token has expired.", "TOKEN_EXPIRED");
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return new ApiError(401, "Token is invalid.", "INVALID_TOKEN");
  }

  return new ApiError(500, "Internal server error.", "INTERNAL_SERVER_ERROR");
};

const toValidationErrors = (details: unknown): ResponseError[] => {
  if (!Array.isArray(details)) {
    return [];
  }

  return details
    .map((issue) => {
      if (
        typeof issue === "object" &&
        issue !== null &&
        "message" in issue &&
        typeof issue.message === "string"
      ) {
        const path =
          "path" in issue && Array.isArray(issue.path)
            ? issue.path.map((segment: unknown) => String(segment)).join(".")
            : undefined;

        return {
          ...(path ? { path } : {}),
          message: issue.message,
        };
      }

      return null;
    })
    .filter((issue): issue is ResponseError => issue !== null);
};

const toDuplicateKeyErrors = (details: unknown): ResponseError[] => {
  if (!details || typeof details !== "object") {
    return [];
  }

  return Object.keys(details).map((key) => ({
    code: "DUPLICATE_RESOURCE",
    path: key,
    message: `${key} already exists.`,
  }));
};

const buildErrorResponse = (apiError: ApiError): { message: string; errors: ResponseError[] } => {
  if (apiError.code === "VALIDATION_ERROR") {
    return {
      message: "Validation failed",
      errors: toValidationErrors(apiError.details),
    };
  }

  if (apiError.code === "DUPLICATE_RESOURCE") {
    return {
      message: apiError.message,
      errors: toDuplicateKeyErrors(apiError.details),
    };
  }

  if (apiError.code === "DATABASE_VALIDATION_ERROR") {
    return {
      message: "Validation failed",
      errors: [],
    };
  }

  if (apiError.code === "FILE_UPLOAD_ERROR") {
    const field =
      apiError.details && typeof apiError.details === "object" && "field" in apiError.details
        ? (apiError.details as { field?: unknown }).field
        : undefined;

    return {
      message: apiError.message,
      errors: [
        {
          code: apiError.code,
          ...(typeof field === "string" ? { path: field } : {}),
          message: apiError.message,
        },
      ],
    };
  }

  return {
    message: apiError.message,
    errors: apiError.statusCode >= 500 ? [] : [{ code: apiError.code, message: apiError.message }],
  };
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found.`, "ROUTE_NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const apiError = normalizeError(error);
  const responseBody = buildErrorResponse(apiError);

  if (apiError.statusCode >= 500) {
    logger.error({ err: error, method: req.method, path: req.originalUrl }, apiError.message);
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: responseBody.message,
    errors: responseBody.errors,
    ...(env.NODE_ENV === "development" ? { stack: apiError.stack } : {}),
  });
};
