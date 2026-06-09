import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { sendTransactionalEmail } from "../../utils/mail.util.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { requireRecentPasswordReauth } from "../auth/auth.reauth.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { MemoryVaultModel } from "../memory-vault/memory-vault.model.js";
import { toPublicMemoryVaultItem } from "../memory-vault/memory-vault.presenter.js";
import {
  TrustedContactModel,
  type TrustedContactDocument,
} from "../trusted-contacts/trusted-contact.model.js";
import { toPublicUser } from "../users/user.presenter.js";
import { UserModel, type UserDocument } from "../users/user.model.js";
import {
  LegacyAccessRequestModel,
  type LegacyAccessRequestDocument,
} from "./legacy-access.model.js";
import { toPublicLegacyAccessRequest } from "./legacy-access.presenter.js";
import type {
  LegacyAccessSettingsInput,
  LegacyAccessRequestIdParams,
} from "./legacy-access.validation.js";
import type { LegacyAccessData } from "./legacy-access.types.js";

const waitingPeriodMs = env.LEGACY_ACCESS_WAITING_DAYS * 24 * 60 * 60 * 1000;
const requestTtlMs = env.LEGACY_ACCESS_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000;

const buildCancelLink = (requestId: string): string =>
  `${env.APP_BASE_URL.replace(/\/$/, "")}/legacy-access/requests/${encodeURIComponent(requestId)}/cancel`;

const sendMail = async (to: string, subject: string, text: string): Promise<void> => {
  await sendTransactionalEmail({
    to,
    subject,
    text,
  });
};

const buildOwnerWarningEmail = (
  ownerName: string,
  trustedContactName: string,
  unlockAt: Date,
  cancelLink: string,
): string =>
  [
    `Hello ${ownerName},`,
    "",
    `Because your account appears inactive, ${trustedContactName} may be eligible for limited legacy access after ${unlockAt.toISOString()}.`,
    `If this should not happen, sign in or cancel the request here: ${cancelLink}`,
    "",
    "No access is granted until the waiting period ends.",
  ].join("\n");

const buildTrustedContactWarningEmail = (
  contactName: string,
  ownerName: string,
  unlockAt: Date,
): string =>
  [
    `Hello ${contactName},`,
    "",
    `A legacy access review for ${ownerName} has been triggered.`,
    `If the request remains valid, you may be able to claim limited view-only access after ${unlockAt.toISOString()}.`,
    "",
    "Do not expect immediate access. Authentication is still required to claim any approved request.",
  ].join("\n");

const buildOwnerApprovedEmail = (ownerName: string, contactName: string): string =>
  [
    `Hello ${ownerName},`,
    "",
    `${contactName} has been granted the legacy access request you were previously notified about.`,
    "",
    "This access is limited and view-only.",
  ].join("\n");

const findLegacyRequestForTrustedContactOrThrow = async (
  requestId: string,
  authenticatedUser: AuthenticatedUser,
): Promise<{ request: LegacyAccessRequestDocument; trustedContact: TrustedContactDocument }> => {
  const request = await LegacyAccessRequestModel.findById(requestId).exec();

  if (!request) {
    throw new ApiError(404, "Legacy access request not found.", "LEGACY_ACCESS_REQUEST_NOT_FOUND");
  }

  const trustedContact = await TrustedContactModel.findOne({
    _id: request.trustedContactId,
    email: authenticatedUser.email,
    status: "accepted",
  }).exec();

  if (!trustedContact) {
    throw new ApiError(
      403,
      "Trusted contact access is not available for this account.",
      "FORBIDDEN",
    );
  }

  return { request, trustedContact };
};

const getLastActivityAt = (user: UserDocument): Date =>
  user.lastActiveAt ?? user.lastLoginAt ?? user.updatedAt ?? user.createdAt;

const buildLegacyAccessData = async (
  owner: UserDocument,
  trustedContact: TrustedContactDocument,
  request: LegacyAccessRequestDocument,
): Promise<LegacyAccessData> => {
  const publicOwner = toPublicUser(owner);
  const data: LegacyAccessData = {
    request: {
      id: request._id.toString(),
      status: request.status,
      triggeredAt: request.triggeredAt.toISOString(),
      unlockAt: request.unlockAt.toISOString(),
      ...(request.approvedAt ? { approvedAt: request.approvedAt.toISOString() } : {}),
    },
    owner: {
      id: owner._id.toString(),
      name: owner.name,
      email: owner.email,
    },
    accessScope: trustedContact.accessScope,
  };

  if (trustedContact.accessScope.profile) {
    data.profile = publicOwner;
  }

  if (trustedContact.accessScope.documents || trustedContact.accessScope.notes) {
    const memories = await MemoryVaultModel.find({ userId: owner._id })
      .sort({ date: -1, createdAt: -1 })
      .exec();
    const publicMemories = memories.map(toPublicMemoryVaultItem);

    if (trustedContact.accessScope.documents) {
      data.documents = publicMemories.filter((memory) => memory.type !== "journal");
    }

    if (trustedContact.accessScope.notes) {
      data.notes = publicMemories.filter((memory) => memory.type === "journal");
    }
  }

  if (trustedContact.accessScope.messages) {
    data.messages = [];
  }

  return data;
};

export const updateLegacyAccessSettings = async (
  user: AuthenticatedUser,
  input: LegacyAccessSettingsInput,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  await requireRecentPasswordReauth(user.id, input.currentPassword);

  const updatedUser = await UserModel.findByIdAndUpdate(
    user.id,
    {
      $set: {
        legacyAccessEnabled: input.legacyAccessEnabled,
      },
    },
    {
      new: true,
    },
  ).exec();

  if (!updatedUser) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  await createAuditLog({
    userId: user.id,
    actorId: user.id,
    actorType: user.role === "admin" || user.role === "super_admin" ? "admin" : "user",
    action: "legacy_access_enabled",
    metadata: {
      enabled: input.legacyAccessEnabled,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    user: toPublicUser(updatedUser),
  };
};

export const listLegacyAccessRequestsForTrustedContact = async (
  authenticatedUser: AuthenticatedUser,
) => {
  const trustedContacts = await TrustedContactModel.find({
    email: authenticatedUser.email,
    status: "accepted",
  }).exec();

  if (trustedContacts.length === 0) {
    return [];
  }

  const trustedContactById = new Map(
    trustedContacts.map((trustedContact) => [trustedContact._id.toString(), trustedContact]),
  );

  const requests = await LegacyAccessRequestModel.find({
    trustedContactId: { $in: trustedContacts.map((trustedContact) => trustedContact._id) },
  })
    .sort({ createdAt: -1 })
    .exec();

  return requests.map((request) => {
    const trustedContact = trustedContactById.get(request.trustedContactId.toString());

    if (!trustedContact) {
      throw new ApiError(500, "Trusted contact lookup failed.", "INTERNAL_SERVER_ERROR");
    }

    return toPublicLegacyAccessRequest(request, trustedContact);
  });
};

export const claimLegacyAccessRequest = async (
  authenticatedUser: AuthenticatedUser,
  params: LegacyAccessRequestIdParams,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const { request, trustedContact } = await findLegacyRequestForTrustedContactOrThrow(
    params.requestId,
    authenticatedUser,
  );

  const now = new Date();

  if (trustedContact.status !== "accepted") {
    throw new ApiError(403, "Trusted contact is no longer eligible.", "FORBIDDEN");
  }

  if (request.status !== "waiting_period") {
    throw new ApiError(
      400,
      "Legacy access request cannot be claimed.",
      "LEGACY_ACCESS_NOT_CLAIMABLE",
    );
  }

  if (request.unlockAt.getTime() > now.getTime()) {
    throw new ApiError(
      403,
      "Legacy access is still in the waiting period.",
      "LEGACY_ACCESS_LOCKED",
    );
  }

  if (request.expiresAt.getTime() < now.getTime()) {
    request.status = "expired";
    await request.save();
    await createAuditLog({
      userId: request.userId.toString(),
      actorId: authenticatedUser.id,
      actorType: "trusted_contact",
      action: "legacy_access_expired",
      metadata: {
        requestId: request._id.toString(),
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
    throw new ApiError(400, "Legacy access request has expired.", "LEGACY_ACCESS_EXPIRED");
  }

  request.status = "approved";
  request.approvedAt = now;
  await request.save();

  const owner = await UserModel.findById(request.userId).exec();

  if (owner) {
    await sendMail(
      owner.email,
      "Legacy access approved",
      buildOwnerApprovedEmail(owner.name, trustedContact.name),
    );
  }

  await createAuditLog({
    userId: request.userId.toString(),
    actorId: authenticatedUser.id,
    actorType: "trusted_contact",
    action: "legacy_access_approved",
    metadata: {
      requestId: request._id.toString(),
      trustedContactId: trustedContact._id.toString(),
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    request: toPublicLegacyAccessRequest(request, trustedContact),
  };
};

export const getLegacyAccessData = async (
  authenticatedUser: AuthenticatedUser,
  params: LegacyAccessRequestIdParams,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const { request, trustedContact } = await findLegacyRequestForTrustedContactOrThrow(
    params.requestId,
    authenticatedUser,
  );

  if (request.status !== "approved") {
    throw new ApiError(403, "Legacy access request is not approved.", "LEGACY_ACCESS_NOT_APPROVED");
  }

  if (request.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "Legacy access request has expired.", "LEGACY_ACCESS_EXPIRED");
  }

  const owner = await UserModel.findById(request.userId).exec();

  if (!owner) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  const data = await buildLegacyAccessData(owner, trustedContact, request);

  await createAuditLog({
    userId: owner._id.toString(),
    actorId: authenticatedUser.id,
    actorType: "trusted_contact",
    action: "legacy_data_viewed",
    metadata: {
      requestId: request._id.toString(),
      trustedContactId: trustedContact._id.toString(),
      scopes: trustedContact.accessScope,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    data,
  };
};

export const cancelLegacyAccessRequest = async (
  authenticatedUser: AuthenticatedUser,
  params: LegacyAccessRequestIdParams,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const request = await LegacyAccessRequestModel.findOne({
    _id: params.requestId,
    userId: authenticatedUser.id,
  }).exec();

  if (!request) {
    throw new ApiError(404, "Legacy access request not found.", "LEGACY_ACCESS_REQUEST_NOT_FOUND");
  }

  if (!["waiting_period", "approved"].includes(request.status)) {
    throw new ApiError(
      400,
      "Legacy access request cannot be cancelled.",
      "LEGACY_ACCESS_NOT_CANCELLABLE",
    );
  }

  request.status = "cancelled";
  request.cancelledAt = new Date();
  await request.save();

  await createAuditLog({
    userId: authenticatedUser.id,
    actorId: authenticatedUser.id,
    actorType:
      authenticatedUser.role === "admin" || authenticatedUser.role === "super_admin"
        ? "admin"
        : "user",
    action: "legacy_access_cancelled",
    metadata: {
      requestId: request._id.toString(),
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    message: "Legacy access request cancelled.",
  };
};

export const cancelWaitingRequestsDueToUserActivity = async (
  userId: string,
  input: {
    action: string;
    actorId?: string;
    actorType: "user" | "admin";
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<void> => {
  const waitingRequests = await LegacyAccessRequestModel.find({
    userId,
    status: "waiting_period",
  }).exec();

  if (waitingRequests.length === 0) {
    return;
  }

  const cancelledAt = new Date();

  for (const request of waitingRequests) {
    request.status = "cancelled";
    request.cancelledAt = cancelledAt;
    await request.save();

    await createAuditLog({
      userId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      metadata: {
        requestId: request._id.toString(),
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
};

export const runLegacyAccessDailyJob = async (): Promise<{
  expiredCount: number;
  triggeredCount: number;
}> => {
  const now = new Date();
  const waitingRequestsToExpire = await LegacyAccessRequestModel.find({
    status: "waiting_period",
    expiresAt: { $lt: now },
  }).exec();

  for (const request of waitingRequestsToExpire) {
    request.status = "expired";
    await request.save();

    await createAuditLog({
      userId: request.userId.toString(),
      actorType: "system",
      action: "legacy_access_expired",
      metadata: {
        requestId: request._id.toString(),
      },
    });
  }

  const users = await UserModel.find({ legacyAccessEnabled: true }).exec();
  let triggeredCount = 0;

  for (const user of users) {
    const trustedContacts = await TrustedContactModel.find({
      userId: user._id,
      status: "accepted",
    }).exec();

    for (const trustedContact of trustedContacts) {
      const inactivityThreshold = new Date(
        now.getTime() - trustedContact.inactivityDays * 24 * 60 * 60 * 1000,
      );

      if (getLastActivityAt(user).getTime() > inactivityThreshold.getTime()) {
        continue;
      }

      const existingRequest = await LegacyAccessRequestModel.exists({
        userId: user._id,
        trustedContactId: trustedContact._id,
        status: { $in: ["waiting_period", "approved"] },
      }).exec();

      if (existingRequest) {
        continue;
      }

      const triggeredAt = new Date();
      const unlockAt = new Date(triggeredAt.getTime() + waitingPeriodMs);
      const expiresAt = new Date(triggeredAt.getTime() + requestTtlMs);

      const request = await LegacyAccessRequestModel.create({
        userId: user._id,
        trustedContactId: trustedContact._id,
        status: "waiting_period",
        triggeredAt,
        unlockAt,
        expiresAt,
      });

      await sendMail(
        user.email,
        "Legacy access warning",
        buildOwnerWarningEmail(
          user.name,
          trustedContact.name,
          unlockAt,
          buildCancelLink(request._id.toString()),
        ),
      );
      await sendMail(
        trustedContact.email,
        "Legacy access waiting period started",
        buildTrustedContactWarningEmail(trustedContact.name, user.name, unlockAt),
      );

      await createAuditLog({
        userId: user._id.toString(),
        actorType: "system",
        action: "legacy_access_triggered",
        metadata: {
          requestId: request._id.toString(),
          trustedContactId: trustedContact._id.toString(),
          unlockAt: unlockAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      });

      triggeredCount += 1;
    }
  }

  return {
    expiredCount: waitingRequestsToExpire.length,
    triggeredCount,
  };
};

let legacyAccessScheduler: NodeJS.Timeout | null = null;

export const startLegacyAccessScheduler = (): void => {
  if (!env.LEGACY_ACCESS_JOB_ENABLED || legacyAccessScheduler) {
    return;
  }

  legacyAccessScheduler = setInterval(
    () => {
      void runLegacyAccessDailyJob().catch(() => undefined);
    },
    env.LEGACY_ACCESS_JOB_INTERVAL_HOURS * 60 * 60 * 1000,
  );

  legacyAccessScheduler.unref();
};

export const stopLegacyAccessScheduler = (): void => {
  if (!legacyAccessScheduler) {
    return;
  }

  clearInterval(legacyAccessScheduler);
  legacyAccessScheduler = null;
};
