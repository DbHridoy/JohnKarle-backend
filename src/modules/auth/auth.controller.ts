import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { sendCreated, sendMessage, sendNoContent, sendSuccess } from "../../utils/response.util.js";
import * as authService from "./auth.service.js";

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  sendCreated(res, {
    message: "Account created successfully.",
    data: result,
  });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  sendSuccess(res, {
    message: "Login successful.",
    data: result,
  });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body);

  sendSuccess(res, {
    message: "Token refreshed successfully.",
    data: result,
  });
});

export const requestPasswordResetCode: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordResetCode(req.body);

  sendMessage(res, result.message);
});

export const verifyPasswordResetCode: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.verifyPasswordResetCode(req.body);

  sendSuccess(res, {
    message: result.message,
    data: {
      resetToken: result.resetToken,
    },
  });
});

export const resetPassword: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);

  sendMessage(res, result.message);
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  const user = await authService.getProfile(req.user.id);

  sendSuccess(res, {
    message: "Profile fetched successfully.",
    data: user,
  });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  await authService.logout(req.user.id);
  sendNoContent(res);
});
