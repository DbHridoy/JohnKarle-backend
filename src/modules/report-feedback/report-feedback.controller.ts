import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { sendCreated, sendPaginated, sendSuccess } from "../../utils/response.util.js";
import { extractReportFeedbackFiles } from "./report-feedback.upload.js";
import * as reportFeedbackService from "./report-feedback.service.js";
import type {
  AdminReportFeedbackListQuery,
  CreateReportFeedbackReplyInput,
  ReportFeedbackIdParams,
  ReportFeedbackListQuery,
  UpdateReportFeedbackStatusInput,
} from "./report-feedback.validation.js";

const requireAuthenticatedUser = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  return req.user;
};

const redactLoggedMessage = (req: Request) => {
  if (typeof req.body === "object" && req.body !== null) {
    if ("subject" in req.body) {
      req.body.subject = "[Redacted]";
    }

    if ("message" in req.body) {
      req.body.message = "[Redacted]";
    }
  }
};

export const createReportFeedback: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const report = await reportFeedbackService.createReportFeedback(
    user,
    req.body,
    extractReportFeedbackFiles(req),
    {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  );

  redactLoggedMessage(req);

  sendCreated(res, {
    message: "Report created successfully.",
    data: report,
  });
});

export const listMyReportFeedback: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await reportFeedbackService.listMyReportFeedback(
    user,
    ((req.validated?.query as ReportFeedbackListQuery | undefined) ?? {
      page: 1,
      limit: 20,
    }) as ReportFeedbackListQuery,
  );

  sendPaginated(res, {
    message: "Reports fetched successfully.",
    data: result.reports,
    meta: result.pagination,
  });
});

export const getReportFeedback: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const report = await reportFeedbackService.getReportFeedback(
    user,
    req.params as ReportFeedbackIdParams,
  );

  sendSuccess(res, {
    message: "Report fetched successfully.",
    data: report,
  });
});

export const addUserReportFeedbackReply: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const report = await reportFeedbackService.addUserReportFeedbackReply(
    user,
    req.params as ReportFeedbackIdParams,
    req.body as CreateReportFeedbackReplyInput,
    extractReportFeedbackFiles(req),
    {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  );

  redactLoggedMessage(req);

  sendSuccess(res, {
    message: "Reply added successfully.",
    data: report,
  });
});

export const listAdminReportFeedback: RequestHandler = asyncHandler(async (req, res) => {
  const result = await reportFeedbackService.listAdminReportFeedback(
    ((req.validated?.query as AdminReportFeedbackListQuery | undefined) ?? {
      page: 1,
      limit: 20,
    }) as AdminReportFeedbackListQuery,
  );

  sendPaginated(res, {
    message: "Reports fetched successfully.",
    data: result.reports,
    meta: result.pagination,
  });
});

export const getAdminReportFeedback: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const report = await reportFeedbackService.getReportFeedback(
    user,
    req.params as ReportFeedbackIdParams,
  );

  sendSuccess(res, {
    message: "Report fetched successfully.",
    data: report,
  });
});

export const addAdminReportFeedbackReply: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const report = await reportFeedbackService.addAdminReportFeedbackReply(
    user,
    req.params as ReportFeedbackIdParams,
    req.body as CreateReportFeedbackReplyInput,
    extractReportFeedbackFiles(req),
    {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  );

  redactLoggedMessage(req);

  sendSuccess(res, {
    message: "Reply added successfully.",
    data: report,
  });
});

export const updateAdminReportFeedbackStatus: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const report = await reportFeedbackService.updateAdminReportFeedbackStatus(
    user,
    req.params as ReportFeedbackIdParams,
    req.body as UpdateReportFeedbackStatusInput,
    {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    },
  );

  sendSuccess(res, {
    message: "Report status updated successfully.",
    data: report,
  });
});
