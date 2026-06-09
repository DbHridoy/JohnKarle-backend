import type { Request, RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
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

  res.status(201).json({
    success: true,
    data: result,
  });
});

export const listTrustedContacts: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const trustedContacts = await trustedContactService.listTrustedContacts(user);

  res.status(200).json({
    success: true,
    data: {
      trustedContacts,
    },
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

  res.status(200).json({
    success: true,
    data: result,
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

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getTrustedContactInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await trustedContactService.getTrustedContactInvitation(
    (req.params as { token: string }).token,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const acceptTrustedContactInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await trustedContactService.acceptTrustedContactInvitation(
    (req.params as { token: string }).token,
    getAuditContext(req),
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const declineTrustedContactInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await trustedContactService.declineTrustedContactInvitation(
    (req.params as { token: string }).token,
    getAuditContext(req),
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});
