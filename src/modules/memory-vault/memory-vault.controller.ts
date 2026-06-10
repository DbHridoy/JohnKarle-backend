import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import * as memoryVaultService from "./memory-vault.service.js";
import { ensureFilesAllowedForType, extractMemoryVaultFiles } from "./memory-vault.upload.js";
import type { MemoryVaultParams, MemoryVaultQuery } from "./memory-vault.validation.js";

const requireAuthenticatedUser = (req: Express.Request) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  return req.user;
};

export const createMemory: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const files = extractMemoryVaultFiles(req);

  ensureFilesAllowedForType(req.body.type, files);

  const memory = await memoryVaultService.createMemory(user, req.body, files);

  res.status(201).json({
    success: true,
    data: {
      memory,
    },
  });
});

export const listMemories: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const memories = await memoryVaultService.listMemories(user, req.query as MemoryVaultQuery);

  res.status(200).json({
    success: true,
    data: {
      memories,
    },
  });
});

export const getTimeline: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const timeline = await memoryVaultService.getTimeline(user, req.query as MemoryVaultQuery);

  res.status(200).json({
    success: true,
    data: {
      timeline,
    },
  });
});

export const getMemory: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const memory = await memoryVaultService.getMemory(user, req.params as MemoryVaultParams);

  res.status(200).json({
    success: true,
    data: {
      memory,
    },
  });
});

export const updateMemory: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const files = extractMemoryVaultFiles(req);
  const memory = await memoryVaultService.updateMemory(
    user,
    req.params as MemoryVaultParams,
    req.body,
    files,
  );

  res.status(200).json({
    success: true,
    data: {
      memory,
    },
  });
});

export const deleteMemory: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);

  await memoryVaultService.deleteMemory(user, req.params as MemoryVaultParams);

  res.status(204).send();
});
