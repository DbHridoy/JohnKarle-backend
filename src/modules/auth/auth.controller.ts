import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import * as authService from "./auth.service.js";

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    data: result,
  });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  const user = await authService.getProfile(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  await authService.logout(req.user.id);
  res.status(204).send();
});
