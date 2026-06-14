import { Router, type Router as ExpressRouter } from "express";

import { validateRequest } from "../../middleware/validate-request.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import { trackAuthenticatedUserActivity } from "../legacy-access/legacy-access.activity.js";
import * as reportFeedbackController from "./report-feedback.controller.js";
import { reportFeedbackUpload } from "./report-feedback.upload.js";
import {
  createReportFeedbackBodySchema,
  createReportFeedbackReplyBodySchema,
  reportFeedbackIdParamsSchema,
  reportFeedbackListQuerySchema,
} from "./report-feedback.validation.js";

export const reportFeedbackRouter: ExpressRouter = Router();

reportFeedbackRouter.use(authenticate, trackAuthenticatedUserActivity);

reportFeedbackRouter.post(
  "/",
  reportFeedbackUpload,
  validateRequest({ body: createReportFeedbackBodySchema }),
  reportFeedbackController.createReportFeedback,
);
reportFeedbackRouter.get(
  "/my",
  validateRequest({ query: reportFeedbackListQuerySchema }),
  reportFeedbackController.listMyReportFeedback,
);
reportFeedbackRouter.get(
  "/:reportId",
  validateRequest({ params: reportFeedbackIdParamsSchema }),
  reportFeedbackController.getReportFeedback,
);
reportFeedbackRouter.post(
  "/:reportId/replies",
  validateRequest({ params: reportFeedbackIdParamsSchema }),
  reportFeedbackUpload,
  validateRequest({ body: createReportFeedbackReplyBodySchema }),
  reportFeedbackController.addUserReportFeedbackReply,
);
