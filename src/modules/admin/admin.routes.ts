import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "../legacy-access/legacy-access.activity.js";
import * as notificationController from "../notifications/notification.controller.js";
import { adminBroadcastBodySchema } from "../notifications/notification.validation.js";
import * as reportFeedbackController from "../report-feedback/report-feedback.controller.js";
import { reportFeedbackUpload } from "../report-feedback/report-feedback.upload.js";
import {
  adminReportFeedbackListQuerySchema,
  createReportFeedbackReplyBodySchema,
  reportFeedbackIdParamsSchema,
  updateReportFeedbackStatusBodySchema,
} from "../report-feedback/report-feedback.validation.js";
import { userProfileUpload } from "../users/user.upload.js";
import * as adminController from "./admin.controller.js";
import {
  adminRecentActivitiesQuerySchema,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  bulkEmailBodySchema,
  changeAdminPasswordBodySchema,
  createEmailTemplateBodySchema,
  createAdminBodySchema,
  emailTemplateIdParamsSchema,
  listEmailTemplatesQuerySchema,
  updateEmailTemplateBodySchema,
  updateAdminProfileBodySchema,
  updateAdminSettingsBodySchema,
} from "./admin.validation.js";

export const adminRouter: ExpressRouter = Router();

adminRouter.use(authenticate, trackAuthenticatedUserActivity);

adminRouter.get("/dashboard/metrics", authorizeAdmin, adminController.getDashboardMetrics);
adminRouter.get(
  "/dashboard/recent-activities",
  authorizeAdmin,
  validateRequest({ query: adminRecentActivitiesQuerySchema }),
  adminController.getRecentActivities,
);
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
  "/email-templates",
  authorizeAdmin,
  validateRequest({ body: createEmailTemplateBodySchema }),
  adminController.createEmailTemplate,
);
adminRouter.get(
  "/email-templates",
  authorizeAdmin,
  validateRequest({ query: listEmailTemplatesQuerySchema }),
  adminController.listEmailTemplates,
);
adminRouter.get(
  "/email-templates/:templateId",
  authorizeAdmin,
  validateRequest({ params: emailTemplateIdParamsSchema }),
  adminController.getEmailTemplateById,
);
adminRouter.patch(
  "/email-templates/:templateId",
  authorizeAdmin,
  validateRequest({
    params: emailTemplateIdParamsSchema,
    body: updateEmailTemplateBodySchema,
  }),
  adminController.updateEmailTemplate,
);
adminRouter.delete(
  "/email-templates/:templateId",
  authorizeAdmin,
  validateRequest({ params: emailTemplateIdParamsSchema }),
  adminController.deleteEmailTemplate,
);
adminRouter.post(
  "/notifications/broadcast",
  authorizeAdmin,
  validateRequest({ body: adminBroadcastBodySchema }),
  notificationController.createAdminBroadcast,
);
adminRouter.get(
  "/report-feedback",
  authorizeAdmin,
  validateRequest({ query: adminReportFeedbackListQuerySchema }),
  reportFeedbackController.listAdminReportFeedback,
);
adminRouter.get(
  "/report-feedback/:reportId",
  authorizeAdmin,
  validateRequest({ params: reportFeedbackIdParamsSchema }),
  reportFeedbackController.getAdminReportFeedback,
);
adminRouter.post(
  "/report-feedback/:reportId/replies",
  authorizeAdmin,
  validateRequest({ params: reportFeedbackIdParamsSchema }),
  reportFeedbackUpload,
  validateRequest({ body: createReportFeedbackReplyBodySchema }),
  reportFeedbackController.addAdminReportFeedbackReply,
);
adminRouter.patch(
  "/report-feedback/:reportId/status",
  authorizeAdmin,
  validateRequest({
    params: reportFeedbackIdParamsSchema,
    body: updateReportFeedbackStatusBodySchema,
  }),
  reportFeedbackController.updateAdminReportFeedbackStatus,
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
