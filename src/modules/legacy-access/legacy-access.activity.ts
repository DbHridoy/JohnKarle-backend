import type { RequestHandler } from "express";

import { env } from "../../config/env.config.js";
import { asyncHandler } from "../../utils/async-handler.util.js";
import { UserModel } from "../users/user.model.js";
import * as legacyAccessService from "./legacy-access.service.js";

const touchThresholdMs = env.LEGACY_ACCESS_ACTIVITY_TOUCH_INTERVAL_MINUTES * 60 * 1000;

export const recordUserActivity = async (
  userId: string,
  options?: {
    action?: string;
    actorType?: "user" | "admin";
    forceCancelWaitingRequests?: boolean;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> => {
  const now = new Date();
  const threshold = new Date(now.getTime() - touchThresholdMs);
  const updatedUser = await UserModel.findOneAndUpdate(
    {
      _id: userId,
      $or: [{ lastActiveAt: { $exists: false } }, { lastActiveAt: { $lt: threshold } }],
    },
    {
      $set: {
        lastActiveAt: now,
      },
    },
    {
      new: true,
    },
  ).exec();

  if (!updatedUser && !options?.forceCancelWaitingRequests) {
    return;
  }

  await legacyAccessService.cancelWaitingRequestsDueToUserActivity(
    (updatedUser?._id ?? userId).toString(),
    {
      action: options?.action ?? "legacy_access_cancelled_due_to_user_activity",
      actorId: (updatedUser?._id ?? userId).toString(),
      actorType: options?.actorType ?? "user",
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    },
  );
};

export const trackAuthenticatedUserActivity: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    if (req.user) {
      await recordUserActivity(req.user.id, {
        actorType: req.user.role === "admin" || req.user.role === "super_admin" ? "admin" : "user",
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      });
    }

    next();
  },
);
