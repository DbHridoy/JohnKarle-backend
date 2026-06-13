import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { sendCreated, sendMessage, sendSuccess } from "../../utils/response.util.js";
import * as userService from "./user.service.js";
import type { FamilyInvitationParams } from "./user.validation.js";

const requireAuthenticatedUser = (req: Express.Request) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication token is required.", "AUTH_REQUIRED");
  }

  return req.user;
};

export const getProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await userService.getProfile(user);

  sendSuccess(res, {
    message: "Profile fetched successfully.",
    data: profile,
  });
});

export const createInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await userService.createInvitation(user, req.body);

  sendCreated(res, {
    message: result.message,
    data: result.invitation,
  });
});

export const acceptInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await userService.acceptInvitation(req.body);

  sendSuccess(res, {
    message: result.message,
    data: {
      email: result.email,
    },
  });
});

export const listInvitations: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const invitations = await userService.listInvitations(user);

  sendSuccess(res, {
    message: "Invitations fetched successfully.",
    data: invitations,
  });
});

export const acceptInvitationById: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await userService.acceptInvitationById(user, req.params as FamilyInvitationParams);

  sendSuccess(res, {
    message: result.message,
    data: {
      email: result.email,
    },
  });
});

export const declineInvitationById: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await userService.declineInvitationById(
    user,
    req.params as FamilyInvitationParams,
  );

  sendMessage(res, result.message);
});

export const listFamilyMembers: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const familyMembers = await userService.listFamilyMembers(user);

  sendSuccess(res, {
    message: "Family members fetched successfully.",
    data: familyMembers,
  });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await userService.updateProfile(user, req.body, req.file);

  sendSuccess(res, {
    message: "Profile updated successfully.",
    data: profile,
  });
});
