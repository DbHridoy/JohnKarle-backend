import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import * as userController from "./user.controller.js";
import { userProfileUpload } from "./user.upload.js";
import { updateProfileBodySchema } from "./user.validation.js";

export const userRouter: ExpressRouter = Router();

userRouter.use(authenticate);

userRouter.get("/profile", userController.getProfile);
userRouter.patch(
  "/profile",
  userProfileUpload,
  validateRequest({ body: updateProfileBodySchema }),
  userController.updateProfile,
);
