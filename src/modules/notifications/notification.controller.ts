import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { sendCreated, sendMessage, sendPaginated, sendSuccess } from "../../utils/response.util.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import * as notificationService from "./notification.service.js";
import type {
  AdminBroadcastInput,
  NotificationIdParams,
  NotificationListQuery,
} from "./notification.validation.js";

const requireAuthenticatedUser = (req: Request): AuthenticatedUser => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  return req.user;
};

export const listNotifications: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const query = (req.validated?.query as NotificationListQuery | undefined) ?? {
    page: 1,
    limit: 20,
  };
  const result = await notificationService.listMyNotifications(user, query);

  sendPaginated(res, {
    message: "Notifications fetched successfully.",
    data: result.notifications,
    meta: result.pagination,
  });
});

export const getUnreadCount: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await notificationService.getUnreadCount(user);

  sendSuccess(res, {
    message: "Unread notification count fetched successfully.",
    data: result,
  });
});

export const markNotificationAsRead: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const notification = await notificationService.markAsRead(
    user,
    req.params as NotificationIdParams,
  );

  sendSuccess(res, {
    message: "Notification marked as read.",
    data: notification,
  });
});

export const markAllNotificationsAsRead: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await notificationService.markAllAsRead(user);

  sendSuccess(res, {
    message: "All notifications marked as read.",
    data: result,
  });
});

export const deleteNotification: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  await notificationService.deleteMyNotification(user, req.params as NotificationIdParams);

  sendMessage(res, "Notification deleted successfully.");
});

export const createAdminBroadcast: RequestHandler = asyncHandler(async (req, res) => {
  const actor = requireAuthenticatedUser(req);
  const result = await notificationService.createAdminBroadcast(
    actor,
    req.body as AdminBroadcastInput,
  );

  sendCreated(res, {
    message: "Admin broadcast created successfully.",
    data: result,
  });
});
