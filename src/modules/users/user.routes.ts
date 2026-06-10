import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "../legacy-access/legacy-access.activity.js";
import * as userController from "./user.controller.js";
import { userProfileUpload } from "./user.upload.js";
import {
  acceptInvitationBodySchema,
  createInvitationBodySchema,
  familyInvitationParamsSchema,
  updateProfileBodySchema,
} from "./user.validation.js";

export const userRouter: ExpressRouter = Router();

userRouter.post(
  "/invitations/accept",
  validateRequest({ body: acceptInvitationBodySchema }),
  userController.acceptInvitation,
);

userRouter.use(authenticate, trackAuthenticatedUserActivity);

userRouter.get("/profile", userController.getProfile);
userRouter.get("/family-members", userController.listFamilyMembers);
userRouter.get("/invitations", userController.listInvitations);
userRouter.post(
  "/invitations",
  validateRequest({ body: createInvitationBodySchema }),
  userController.createInvitation,
);
userRouter.post(
  "/invitations/:invitationId/accept",
  validateRequest({ params: familyInvitationParamsSchema }),
  userController.acceptInvitationById,
);
userRouter.post(
  "/invitations/:invitationId/decline",
  validateRequest({ params: familyInvitationParamsSchema }),
  userController.declineInvitationById,
);
userRouter.patch(
  "/profile",
  userProfileUpload,
  validateRequest({ body: updateProfileBodySchema }),
  userController.updateProfile,
);
