import rateLimit from "express-rate-limit";
import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "./legacy-access.activity.js";
import * as legacyAccessController from "./legacy-access.controller.js";
import {
  legacyAccessRequestIdParamsSchema,
  legacyAccessSettingsBodySchema,
} from "./legacy-access.validation.js";

const legacyClaimLimiter = rateLimit({
  legacyHeaders: false,
  limit: 20,
  standardHeaders: "draft-8",
  windowMs: 15 * 60 * 1000,
});

export const legacyAccessRouter: ExpressRouter = Router();

legacyAccessRouter.use(authenticate, trackAuthenticatedUserActivity);

legacyAccessRouter.patch(
  "/settings",
  validateRequest({ body: legacyAccessSettingsBodySchema }),
  legacyAccessController.updateLegacyAccessSettings,
);
legacyAccessRouter.get("/requests", legacyAccessController.listLegacyAccessRequests);
legacyAccessRouter.post(
  "/:requestId/claim",
  legacyClaimLimiter,
  validateRequest({ params: legacyAccessRequestIdParamsSchema }),
  legacyAccessController.claimLegacyAccessRequest,
);
legacyAccessRouter.get(
  "/:requestId/data",
  validateRequest({ params: legacyAccessRequestIdParamsSchema }),
  legacyAccessController.getLegacyAccessData,
);
legacyAccessRouter.post(
  "/:requestId/cancel",
  validateRequest({ params: legacyAccessRequestIdParamsSchema }),
  legacyAccessController.cancelLegacyAccessRequest,
);
