import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
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

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const listLegacyAccessRequests: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const requests = await legacyAccessService.listLegacyAccessRequestsForTrustedContact(user);

  res.status(200).json({
    success: true,
    data: {
      requests,
    },
  });
});

export const claimLegacyAccessRequest: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await legacyAccessService.claimLegacyAccessRequest(
    user,
    req.params as { requestId: string },
    getAuditContext(req),
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getLegacyAccessData: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await legacyAccessService.getLegacyAccessData(
    user,
    req.params as { requestId: string },
    getAuditContext(req),
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const cancelLegacyAccessRequest: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await legacyAccessService.cancelLegacyAccessRequest(
    user,
    req.params as { requestId: string },
    getAuditContext(req),
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});
