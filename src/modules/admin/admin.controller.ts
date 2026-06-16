import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { sendCreated, sendMessage, sendPaginated, sendSuccess } from "../../utils/response.util.js";
import * as adminService from "./admin.service.js";
import type {
  AdminRecentActivitiesQuery,
  AdminUserIdParams,
  AdminUserListQuery,
  BulkEmailInput,
  ChangeAdminPasswordInput,
  CreateEmailTemplateInput,
  CreateAdminInput,
  EmailTemplateIdParams,
  ListEmailTemplatesQuery,
  UpdateEmailTemplateInput,
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

  sendSuccess(res, {
    message: "Dashboard metrics fetched successfully.",
    data: metrics,
  });
});

export const getRecentActivities: RequestHandler = asyncHandler(async (req, res) => {
  const query = (req.validated?.query as AdminRecentActivitiesQuery | undefined) ?? {
    page: 1,
    limit: 20,
  };
  const result = await adminService.listRecentActivities(query);

  sendPaginated(res, {
    message: "Recent activities fetched successfully.",
    data: result.activities,
    meta: result.pagination,
  });
});

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const query = (req.validated?.query as AdminUserListQuery | undefined) ?? {
    page: 1,
    limit: 20,
  };
  const result = await adminService.listAdminUsers(query);

  sendPaginated(res, {
    message: "Users fetched successfully.",
    data: result.users,
    meta: result.pagination,
  });
});

export const getUserById: RequestHandler = asyncHandler(async (req, res) => {
  const user = await adminService.getAdminUserById(req.params as AdminUserIdParams);

  sendSuccess(res, {
    message: "User fetched successfully.",
    data: user,
  });
});

export const createAdmin: RequestHandler = asyncHandler(async (req, res) => {
  const actor = requireAuthenticatedUser(req);
  const user = await adminService.createAdminUser(actor, req.body as CreateAdminInput);

  sendCreated(res, {
    message: "Admin created successfully.",
    data: user,
  });
});

export const sendBulkEmail: RequestHandler = asyncHandler(async (req, res) => {
  const actor = requireAuthenticatedUser(req);
  const result = await adminService.sendBulkEmail(actor, req.body as BulkEmailInput);

  if (typeof req.body === "object" && req.body !== null && "message" in req.body) {
    req.body.message = "[Redacted]";
  }

  sendSuccess(res, {
    message: "Bulk email completed successfully.",
    data: result,
  });
});

export const createEmailTemplate: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const template = await adminService.createEmailTemplate(
    user,
    req.body as CreateEmailTemplateInput,
  );

  sendCreated(res, {
    message: "Email template created successfully.",
    data: template,
  });
});

export const listEmailTemplates: RequestHandler = asyncHandler(async (req, res) => {
  const query = (req.validated?.query as ListEmailTemplatesQuery | undefined) ?? {
    page: 1,
    limit: 20,
  };
  const result = await adminService.listEmailTemplates(query);

  sendPaginated(res, {
    message: "Email templates fetched successfully.",
    data: result.templates,
    meta: result.pagination,
  });
});

export const getEmailTemplateById: RequestHandler = asyncHandler(async (req, res) => {
  const template = await adminService.getEmailTemplateById(req.params as EmailTemplateIdParams);

  sendSuccess(res, {
    message: "Email template fetched successfully.",
    data: template,
  });
});

export const updateEmailTemplate: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const template = await adminService.updateEmailTemplate(
    user,
    req.params as EmailTemplateIdParams,
    req.body as UpdateEmailTemplateInput,
  );

  sendSuccess(res, {
    message: "Email template updated successfully.",
    data: template,
  });
});

export const deleteEmailTemplate: RequestHandler = asyncHandler(async (req, res) => {
  const result = await adminService.deleteEmailTemplate(req.params as EmailTemplateIdParams);

  sendMessage(res, result.message);
});

export const getProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await adminService.getAdminProfile(user);

  sendSuccess(res, {
    message: "Profile fetched successfully.",
    data: profile,
  });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await adminService.updateAdminProfile(
    user,
    req.body as UpdateAdminProfileInput,
    req.file,
  );

  sendSuccess(res, {
    message: "Profile updated successfully.",
    data: profile,
  });
});

export const changePassword: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await adminService.changeAdminPassword(user, req.body as ChangeAdminPasswordInput);

  sendMessage(res, result.message);
});

export const getSettings: RequestHandler = asyncHandler(async (_req, res) => {
  const settings = await adminService.getAdminSettings();

  sendSuccess(res, {
    message: "Settings fetched successfully.",
    data: settings,
  });
});

export const updateSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const settings = await adminService.updateAdminSettings(
    user,
    req.body as UpdateAdminSettingsInput,
  );

  sendSuccess(res, {
    message: "Settings updated successfully.",
    data: settings,
  });
});
