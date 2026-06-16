import rateLimit from "express-rate-limit";
import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "../legacy-access/legacy-access.activity.js";
import * as trustedContactController from "./trusted-contact.controller.js";
import {
  createTrustedContactBodySchema,
  deleteTrustedContactBodySchema,
  trustedContactIdParamsSchema,
  trustedContactInviteTokenParamsSchema,
  updateTrustedContactBodySchema,
} from "./trusted-contact.validation.js";

const trustedContactInviteLimiter = rateLimit({
  legacyHeaders: false,
  limit: 20,
  standardHeaders: "draft-8",
  windowMs: 15 * 60 * 1000,
});

export const trustedContactRouter: ExpressRouter = Router();

trustedContactRouter.get(
  "/invite/:token",
  trustedContactInviteLimiter,
  validateRequest({ params: trustedContactInviteTokenParamsSchema }),
  trustedContactController.getTrustedContactInvitation,
);
trustedContactRouter.post(
  "/invite/:token/accept",
  trustedContactInviteLimiter,
  validateRequest({ params: trustedContactInviteTokenParamsSchema }),
  trustedContactController.acceptTrustedContactInvitation,
);
trustedContactRouter.post(
  "/invite/:token/decline",
  trustedContactInviteLimiter,
  validateRequest({ params: trustedContactInviteTokenParamsSchema }),
  trustedContactController.declineTrustedContactInvitation,
);

trustedContactRouter.use(authenticate, trackAuthenticatedUserActivity);

trustedContactRouter.post(
  "/",
  validateRequest({ body: createTrustedContactBodySchema }),
  trustedContactController.createTrustedContact,
);
trustedContactRouter.get("/", trustedContactController.listTrustedContacts);
trustedContactRouter.get("/invitations", trustedContactController.listTrustedContactInvitations);
trustedContactRouter.post(
  "/invitations/:id/accept",
  validateRequest({ params: trustedContactIdParamsSchema }),
  trustedContactController.acceptTrustedContactInvitationById,
);
trustedContactRouter.post(
  "/invitations/:id/decline",
  validateRequest({ params: trustedContactIdParamsSchema }),
  trustedContactController.declineTrustedContactInvitationById,
);
trustedContactRouter.patch(
  "/:id",
  validateRequest({
    params: trustedContactIdParamsSchema,
    body: updateTrustedContactBodySchema,
  }),
  trustedContactController.updateTrustedContact,
);
trustedContactRouter.delete(
  "/:id",
  validateRequest({
    params: trustedContactIdParamsSchema,
    body: deleteTrustedContactBodySchema,
  }),
  trustedContactController.removeTrustedContact,
);
