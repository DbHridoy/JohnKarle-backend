import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "../legacy-access/legacy-access.activity.js";
import * as notificationController from "./notification.controller.js";
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
} from "./notification.validation.js";

export const notificationRouter: ExpressRouter = Router();

notificationRouter.use(authenticate, trackAuthenticatedUserActivity);

notificationRouter.get(
  "/",
  validateRequest({ query: notificationListQuerySchema }),
  notificationController.listNotifications,
);
notificationRouter.get("/unread-count", notificationController.getUnreadCount);
notificationRouter.patch("/read-all", notificationController.markAllNotificationsAsRead);
notificationRouter.patch(
  "/:notificationId/read",
  validateRequest({ params: notificationIdParamsSchema }),
  notificationController.markNotificationAsRead,
);
notificationRouter.delete(
  "/:notificationId",
  validateRequest({ params: notificationIdParamsSchema }),
  notificationController.deleteNotification,
);
