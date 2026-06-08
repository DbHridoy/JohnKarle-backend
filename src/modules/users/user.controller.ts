import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import * as userService from "./user.service.js";

const requireAuthenticatedUser = (req: Express.Request) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  return req.user;
};

export const getProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await userService.getProfile(user);

  res.status(200).json({
    success: true,
    data: {
      user: profile,
    },
  });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await userService.updateProfile(user, req.body, req.file);

  res.status(200).json({
    success: true,
    data: {
      user: profile,
    },
  });
});
