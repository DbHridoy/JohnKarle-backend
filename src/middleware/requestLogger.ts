import type { RequestHandler } from "express";

import { logger } from "../utils/logger.js";

const MAX_LOG_BODY_LENGTH = 10_000;
const MAX_LOG_DEPTH = 5;
const MAX_ARRAY_ITEMS = 50;

const REDACTED_VALUE = "[Redacted]";
const TRUNCATED_VALUE = "[Truncated]";

const SENSITIVE_KEYS = new Set([
  "accessToken",
  "apiKey",
  "authorization",
  "cookie",
  "jwt",
  "password",
  "passwordHash",
  "refreshToken",
  "secret",
  "set-cookie",
  "token",
]);

const isSensitiveKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();

  return [...SENSITIVE_KEYS].some((sensitiveKey) =>
    normalizedKey.includes(sensitiveKey.toLowerCase()),
  );
};

const truncateString = (value: string): string => {
  if (value.length <= MAX_LOG_BODY_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_BODY_LENGTH)}... [truncated ${value.length - MAX_LOG_BODY_LENGTH} chars]`;
};

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const redactValue = (value: unknown, depth = 0): unknown => {
  if (depth >= MAX_LOG_DEPTH) {
    return TRUNCATED_VALUE;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? REDACTED_VALUE : redactValue(item, depth + 1),
      ]),
    );
  }

  return String(value);
};

const serializeBodyForLog = (body: unknown): unknown => {
  if (typeof body === "string") {
    return redactValue(tryParseJson(body));
  }

  return redactValue(body);
};

export const requestLogger: RequestHandler = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const originalSend = res.send.bind(res);

  let responseBody: unknown;

  res.send = ((body?: unknown) => {
    responseBody = serializeBodyForLog(body);

    return originalSend(body);
  }) as typeof res.send;

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    logger.info(
      {
        durationMs: Math.round(durationMs),
        request: {
          body: redactValue(req.body),
          method: req.method,
          params: redactValue(req.params),
          query: redactValue(req.query),
          url: req.originalUrl,
        },
        response: {
          body: responseBody,
          statusCode: res.statusCode,
        },
      },
      "request completed",
    );
  });

  next();
};
