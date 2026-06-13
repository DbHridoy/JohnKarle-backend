import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { sendMessage, sendSuccess } from "../../utils/response.util.js";
import * as legacyAccessService from "./legacy-access.service.js";

const requireAuthenticatedUser = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  return req.user;
};

const getAuditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

export const updateLegacyAccessSettings: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await legacyAccessService.updateLegacyAccessSettings(
    user,
    req.body,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: "Legacy access settings updated successfully.",
    data: result.user,
  });
});

export const listLegacyAccessRequests: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const requests = await legacyAccessService.listLegacyAccessRequestsForTrustedContact(user);

  sendSuccess(res, {
    message: "Legacy access requests fetched successfully.",
    data: requests,
  });
});

export const claimLegacyAccessRequest: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await legacyAccessService.claimLegacyAccessRequest(
    user,
    req.params as { requestId: string },
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: "Legacy access request claimed successfully.",
    data: result.request,
  });
});

export const getLegacyAccessData: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await legacyAccessService.getLegacyAccessData(
    user,
    req.params as { requestId: string },
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: "Legacy access data fetched successfully.",
    data: result.data,
  });
});

export const cancelLegacyAccessRequest: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await legacyAccessService.cancelLegacyAccessRequest(
    user,
    req.params as { requestId: string },
    getAuditContext(req),
  );

  sendMessage(res, result.message);
});
