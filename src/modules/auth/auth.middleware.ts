import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { UserModel } from "../users/user.model.js";
import type { UserRole } from "../users/user.types.js";
import { verifyToken } from "./auth.tokens.js";

const bearerPrefix = "Bearer ";

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith(bearerPrefix)) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  const token = authorization.slice(bearerPrefix.length).trim();
  const payload = verifyToken(token, "access");
  const user = await UserModel.findById(payload.sub).exec();

  if (!user || user.refreshTokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, "Authentication token is invalid.", "INVALID_TOKEN");
  }

  req.user = {
    email: user.email,
    id: user._id.toString(),
    role: user.role,
    tokenVersion: user.refreshTokenVersion,
  };

  next();
});

export const authorize =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, "You do not have permission to access this resource.", "FORBIDDEN"));
      return;
    }

    next();
  };
