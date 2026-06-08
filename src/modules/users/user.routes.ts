import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import * as userController from "./user.controller.js";
import { userProfileUpload } from "./user.upload.js";
import {
  acceptInvitationBodySchema,
  createInvitationBodySchema,
  updateProfileBodySchema,
} from "./user.validation.js";

export const userRouter: ExpressRouter = Router();

userRouter.post(
  "/invitations/accept",
  validateRequest({ body: acceptInvitationBodySchema }),
  userController.acceptInvitation,
);

userRouter.use(authenticate);

userRouter.get("/profile", userController.getProfile);
userRouter.post(
  "/invitations",
  validateRequest({ body: createInvitationBodySchema }),
  userController.createInvitation,
);
userRouter.patch(
  "/profile",
  userProfileUpload,
  validateRequest({ body: updateProfileBodySchema }),
  userController.updateProfile,
);
