import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { sendCreated, sendMessage, sendSuccess } from "../../utils/response.util.js";
import * as trustedContactService from "./trusted-contact.service.js";

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

export const createTrustedContact: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await trustedContactService.createTrustedContact(
    user,
    req.body,
    getAuditContext(req),
  );

  sendCreated(res, {
    message: result.message,
    data: result.trustedContact,
  });
});

export const listTrustedContacts: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const trustedContacts = await trustedContactService.listTrustedContacts(user);

  sendSuccess(res, {
    message: "Trusted contacts fetched successfully.",
    data: trustedContacts,
  });
});

export const updateTrustedContact: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await trustedContactService.updateTrustedContact(
    user,
    req.params as { id: string },
    req.body,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: "Trusted contact updated successfully.",
    data: result.trustedContact,
  });
});

export const removeTrustedContact: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await trustedContactService.removeTrustedContact(
    user,
    req.params as { id: string },
    req.body,
    getAuditContext(req),
  );

  sendMessage(res, result.message);
});

export const getTrustedContactInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await trustedContactService.getTrustedContactInvitation(
    (req.params as { token: string }).token,
  );

  sendSuccess(res, {
    message: "Trusted contact invitation fetched successfully.",
    data: result.invitation,
  });
});

export const acceptTrustedContactInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await trustedContactService.acceptTrustedContactInvitation(
    (req.params as { token: string }).token,
    getAuditContext(req),
  );

  sendSuccess(res, {
    message: result.message,
    data: result.trustedContact,
  });
});

export const declineTrustedContactInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await trustedContactService.declineTrustedContactInvitation(
    (req.params as { token: string }).token,
    getAuditContext(req),
  );

  sendMessage(res, result.message);
});
