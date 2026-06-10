import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import * as adminService from "./admin.service.js";
import type {
  AdminUserIdParams,
  AdminUserListQuery,
  BulkEmailInput,
  ChangeAdminPasswordInput,
  CreateAdminInput,
  UpdateAdminProfileInput,
  UpdateAdminSettingsInput,
} from "./admin.validation.js";

const requireAuthenticatedUser = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  return req.user;
};

export const getDashboardMetrics: RequestHandler = asyncHandler(async (_req, res) => {
  const metrics = await adminService.getDashboardMetrics();

  res.status(200).json({
    success: true,
    data: metrics,
  });
});

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const result = await adminService.listAdminUsers(req.query as unknown as AdminUserListQuery);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getUserById: RequestHandler = asyncHandler(async (req, res) => {
  const user = await adminService.getAdminUserById(req.params as AdminUserIdParams);

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

export const createAdmin: RequestHandler = asyncHandler(async (req, res) => {
  const user = await adminService.createAdminUser(req.body as CreateAdminInput);

  res.status(201).json({
    success: true,
    data: {
      user,
    },
  });
});

export const sendBulkEmail: RequestHandler = asyncHandler(async (req, res) => {
  const result = await adminService.sendBulkEmail(req.body as BulkEmailInput);

  if (typeof req.body === "object" && req.body !== null && "message" in req.body) {
    req.body.message = "[Redacted]";
  }

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await adminService.getAdminProfile(user);

  res.status(200).json({
    success: true,
    data: {
      user: profile,
    },
  });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await adminService.updateAdminProfile(
    user,
    req.body as UpdateAdminProfileInput,
    req.file,
  );

  res.status(200).json({
    success: true,
    data: {
      user: profile,
    },
  });
});

export const changePassword: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await adminService.changeAdminPassword(user, req.body as ChangeAdminPasswordInput);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getSettings: RequestHandler = asyncHandler(async (_req, res) => {
  const settings = await adminService.getAdminSettings();

  res.status(200).json({
    success: true,
    data: {
      settings,
    },
  });
});

export const updateSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const settings = await adminService.updateAdminSettings(
    user,
    req.body as UpdateAdminSettingsInput,
  );

  res.status(200).json({
    success: true,
    data: {
      settings,
    },
  });
});
