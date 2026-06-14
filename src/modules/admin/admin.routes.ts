import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "../legacy-access/legacy-access.activity.js";
import * as notificationController from "../notifications/notification.controller.js";
import { adminBroadcastBodySchema } from "../notifications/notification.validation.js";
import { userProfileUpload } from "../users/user.upload.js";
import * as adminController from "./admin.controller.js";
import {
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  bulkEmailBodySchema,
  changeAdminPasswordBodySchema,
  createAdminBodySchema,
  updateAdminProfileBodySchema,
  updateAdminSettingsBodySchema,
} from "./admin.validation.js";

export const adminRouter: ExpressRouter = Router();

adminRouter.use(authenticate, trackAuthenticatedUserActivity);

adminRouter.get("/dashboard/metrics", authorizeAdmin, adminController.getDashboardMetrics);
adminRouter.get(
  "/users",
  authorizeAdmin,
  validateRequest({ query: adminUserListQuerySchema }),
  adminController.listUsers,
);
adminRouter.get(
  "/users/:userId",
  authorizeAdmin,
  validateRequest({ params: adminUserIdParamsSchema }),
  adminController.getUserById,
);
adminRouter.post(
  "/admins",
  authorizeSuperAdmin,
  validateRequest({ body: createAdminBodySchema }),
  adminController.createAdmin,
);
adminRouter.post(
  "/bulk-email",
  authorizeAdmin,
  validateRequest({ body: bulkEmailBodySchema }),
  adminController.sendBulkEmail,
);
adminRouter.post(
  "/notifications/broadcast",
  authorizeAdmin,
  validateRequest({ body: adminBroadcastBodySchema }),
  notificationController.createAdminBroadcast,
);
adminRouter.get("/profile", authorizeAdmin, adminController.getProfile);
adminRouter.patch(
  "/profile",
  authorizeAdmin,
  userProfileUpload,
  validateRequest({ body: updateAdminProfileBodySchema }),
  adminController.updateProfile,
);
adminRouter.patch(
  "/profile/password",
  authorizeAdmin,
  validateRequest({ body: changeAdminPasswordBodySchema }),
  adminController.changePassword,
);
adminRouter.get("/settings", authorizeAdmin, adminController.getSettings);
adminRouter.patch(
  "/settings",
  authorizeSuperAdmin,
  validateRequest({ body: updateAdminSettingsBodySchema }),
  adminController.updateSettings,
);
