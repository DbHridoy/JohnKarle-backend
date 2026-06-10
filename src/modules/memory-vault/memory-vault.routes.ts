import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "../legacy-access/legacy-access.activity.js";
import * as memoryVaultController from "./memory-vault.controller.js";
import {
  createMemoryVaultBodySchema,
  memoryVaultParamsSchema,
  memoryVaultQuerySchema,
  updateMemoryVaultBodySchema,
} from "./memory-vault.validation.js";
import { memoryVaultUpload, normalizeMemoryVaultPayload } from "./memory-vault.upload.js";

export const memoryVaultRouter: ExpressRouter = Router();

memoryVaultRouter.use(authenticate, trackAuthenticatedUserActivity);

memoryVaultRouter.get(
  "/",
  validateRequest({ query: memoryVaultQuerySchema }),
  memoryVaultController.listMemories,
);
memoryVaultRouter.get(
  "/timeline",
  validateRequest({ query: memoryVaultQuerySchema }),
  memoryVaultController.getTimeline,
);
memoryVaultRouter.get(
  "/:memoryId",
  validateRequest({ params: memoryVaultParamsSchema }),
  memoryVaultController.getMemory,
);
memoryVaultRouter.post(
  "/",
  memoryVaultUpload,
  normalizeMemoryVaultPayload,
  validateRequest({ body: createMemoryVaultBodySchema }),
  memoryVaultController.createMemory,
);
memoryVaultRouter.patch(
  "/:memoryId",
  validateRequest({ params: memoryVaultParamsSchema }),
  memoryVaultUpload,
  normalizeMemoryVaultPayload,
  validateRequest({ body: updateMemoryVaultBodySchema }),
  memoryVaultController.updateMemory,
);
memoryVaultRouter.delete(
  "/:memoryId",
  validateRequest({ params: memoryVaultParamsSchema }),
  memoryVaultController.deleteMemory,
);
