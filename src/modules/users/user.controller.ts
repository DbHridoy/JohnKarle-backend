import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
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

  res.status(200).json({
    success: true,
    data: {
      user: profile,
    },
  });
});

export const createInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await userService.createInvitation(user, req.body);

  res.status(201).json({
    success: true,
    data: result,
  });
});

export const acceptInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const result = await userService.acceptInvitation(req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const listInvitations: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const invitations = await userService.listInvitations(user);

  res.status(200).json({
    success: true,
    data: {
      invitations,
    },
  });
});

export const acceptInvitationById: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await userService.acceptInvitationById(user, req.params as FamilyInvitationParams);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const declineInvitationById: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const result = await userService.declineInvitationById(
    user,
    req.params as FamilyInvitationParams,
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const listFamilyMembers: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const familyMembers = await userService.listFamilyMembers(user);

  res.status(200).json({
    success: true,
    data: {
      familyMembers,
    },
  });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req);
  const profile = await userService.updateProfile(user, req.body, req.file);

  res.status(200).json({
    success: true,
    data: {
      user: profile,
    },
  });
});
