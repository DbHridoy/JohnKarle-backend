import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import * as authController from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";
import { loginBodySchema, refreshBodySchema, registerBodySchema } from "./auth.validation.js";

export const authRouter: ExpressRouter = Router();

authRouter.post(
  "/register",
  validateRequest({ body: registerBodySchema }),
  authController.register,
);
authRouter.post("/login", validateRequest({ body: loginBodySchema }), authController.login);
authRouter.post("/refresh", validateRequest({ body: refreshBodySchema }), authController.refresh);
authRouter.get("/me", authenticate, authController.me);
authRouter.post("/logout", authenticate, authController.logout);
