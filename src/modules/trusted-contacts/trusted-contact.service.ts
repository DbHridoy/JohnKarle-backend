import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { sendTransactionalEmail } from "../../utils/mail.util.js";
import { generateSecureToken, hashToken, verifyTokenHash } from "../../utils/token.util.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { requireRecentPasswordReauth } from "../auth/auth.reauth.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { UserModel } from "../users/user.model.js";
import { LegacyAccessRequestModel } from "../legacy-access/legacy-access.model.js";
import { toPublicTrustedContact } from "./trusted-contact.presenter.js";
import { TrustedContactModel, type TrustedContactDocument } from "./trusted-contact.model.js";
import type {
  CreateTrustedContactInput,
  DeleteTrustedContactInput,
  TrustedContactIdParams,
  UpdateTrustedContactInput,
} from "./trusted-contact.validation.js";

const invitationExpiresInMs = env.LEGACY_ACCESS_INVITE_EXPIRES_HOURS * 60 * 60 * 1000;

const buildTrustedContactInviteLink = (token: string): string =>
  `${env.APP_BASE_URL.replace(/\/$/, "")}/legacy-access/invite?token=${encodeURIComponent(token)}`;

const buildInvitationEmail = (
  ownerName: string,
  contactName: string,
  invitationLink: string,
): string =>
  [
    `Hello ${contactName},`,
    "",
    `${ownerName} added you as a trusted contact for legacy access.`,
    `Review the invitation here: ${invitationLink}`,
    `This invitation expires in ${env.LEGACY_ACCESS_INVITE_EXPIRES_HOURS} hours.`,
    "",
    "Accepting the invitation does not grant immediate access.",
  ].join("\n");

const sendTrustedContactInvitationEmail = async (
  ownerName: string,
  contactName: string,
  contactEmail: string,
  inviteToken: string,
): Promise<void> => {
  await sendTransactionalEmail({
    to: contactEmail,
    subject: "Trusted contact invitation",
    text: buildInvitationEmail(ownerName, contactName, buildTrustedContactInviteLink(inviteToken)),
  });
};

const findOwnedTrustedContactOrThrow = async (
  userId: string,
  trustedContactId: string,
): Promise<TrustedContactDocument> => {
  const trustedContact = await TrustedContactModel.findOne({
    _id: trustedContactId,
    userId,
  }).exec();

  if (!trustedContact) {
    throw new ApiError(404, "Trusted contact not found.", "TRUSTED_CONTACT_NOT_FOUND");
  }

  return trustedContact;
};

const findTrustedContactByInviteTokenOrThrow = async (
  token: string,
): Promise<TrustedContactDocument> => {
  const tokenHash = hashToken(token);
  const trustedContact = await TrustedContactModel.findOne({
    inviteTokenHash: tokenHash,
  })
    .select("+inviteTokenHash +inviteTokenExpiresAt")
    .exec();

  if (
    !trustedContact ||
    !trustedContact.inviteTokenHash ||
    !trustedContact.inviteTokenExpiresAt ||
    !verifyTokenHash(token, trustedContact.inviteTokenHash)
  ) {
    throw new ApiError(400, "Invitation is invalid.", "INVALID_TRUSTED_CONTACT_INVITATION");
  }

  if (trustedContact.inviteTokenExpiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "Invitation has expired.", "TRUSTED_CONTACT_INVITATION_EXPIRED");
  }

  return trustedContact;
};

const ensureTrustedContactCanBeCreated = async (
  user: AuthenticatedUser,
  email: string,
): Promise<void> => {
  if (email === user.email.trim().toLowerCase()) {
    throw new ApiError(
      400,
      "You cannot add your own email as a trusted contact.",
      "TRUSTED_CONTACT_SELF_REFERENCE",
    );
  }

  const existingTrustedContact = await TrustedContactModel.exists({
    userId: user.id,
    email,
    status: { $in: ["pending", "accepted"] },
  }).exec();

  if (existingTrustedContact) {
    throw new ApiError(
      409,
      "An active trusted contact with this email already exists.",
      "TRUSTED_CONTACT_ALREADY_EXISTS",
    );
  }
};

export const createTrustedContact = async (
  user: AuthenticatedUser,
  input: CreateTrustedContactInput,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  await requireRecentPasswordReauth(user.id, input.currentPassword);

  const owner = await UserModel.findById(user.id).exec();

  if (!owner) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  await ensureTrustedContactCanBeCreated(user, input.email);

  const inviteToken = generateSecureToken();
  const inviteTokenExpiresAt = new Date(Date.now() + invitationExpiresInMs);

  const trustedContact = await TrustedContactModel.create({
    userId: user.id,
    name: input.name,
    email: input.email,
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    inactivityDays: input.inactivityDays,
    accessScope: input.accessScope,
    inviteTokenHash: hashToken(inviteToken),
    inviteTokenExpiresAt,
    status: "pending",
  });

  try {
    await sendTrustedContactInvitationEmail(
      owner.name,
      trustedContact.name,
      trustedContact.email,
      inviteToken,
    );
  } catch (error) {
    await TrustedContactModel.deleteOne({ _id: trustedContact._id }).exec();
    throw error;
  }

  await createAuditLog({
    userId: user.id,
    actorId: user.id,
    actorType: user.role === "admin" || user.role === "super_admin" ? "admin" : "user",
    action: "trusted_contact_added",
    metadata: {
      trustedContactId: trustedContact._id.toString(),
      email: trustedContact.email,
      inactivityDays: trustedContact.inactivityDays,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    trustedContact: toPublicTrustedContact(trustedContact),
    message: "Trusted contact added successfully.",
  };
};

export const listTrustedContacts = async (user: AuthenticatedUser) => {
  const trustedContacts = await TrustedContactModel.find({ userId: user.id })
    .sort({ createdAt: -1 })
    .exec();

  return trustedContacts.map(toPublicTrustedContact);
};

export const updateTrustedContact = async (
  user: AuthenticatedUser,
  params: TrustedContactIdParams,
  input: UpdateTrustedContactInput,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  await requireRecentPasswordReauth(user.id, input.currentPassword);
  const trustedContact = await findOwnedTrustedContactOrThrow(user.id, params.id);

  if (trustedContact.status === "removed") {
    throw new ApiError(
      400,
      "Removed trusted contacts cannot be updated.",
      "TRUSTED_CONTACT_REMOVED",
    );
  }

  if (input.name !== undefined) {
    trustedContact.name = input.name;
  }

  if (input.phone !== undefined) {
    trustedContact.phone = input.phone;
  }

  if (input.inactivityDays !== undefined) {
    trustedContact.inactivityDays = input.inactivityDays;
  }

  if (input.accessScope !== undefined) {
    trustedContact.accessScope = input.accessScope;
  }

  await trustedContact.save();

  await createAuditLog({
    userId: user.id,
    actorId: user.id,
    actorType: user.role === "admin" || user.role === "super_admin" ? "admin" : "user",
    action: "trusted_contact_updated",
    metadata: {
      trustedContactId: trustedContact._id.toString(),
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    trustedContact: toPublicTrustedContact(trustedContact),
  };
};

export const removeTrustedContact = async (
  user: AuthenticatedUser,
  params: TrustedContactIdParams,
  input: DeleteTrustedContactInput,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  await requireRecentPasswordReauth(user.id, input.currentPassword);
  const trustedContact = await findOwnedTrustedContactOrThrow(user.id, params.id);

  trustedContact.status = "removed";
  trustedContact.inviteTokenHash = undefined;
  trustedContact.inviteTokenExpiresAt = undefined;
  await trustedContact.save();

  const now = new Date();
  await LegacyAccessRequestModel.updateMany(
    {
      trustedContactId: trustedContact._id,
      status: { $in: ["waiting_period", "approved"] },
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
      },
    },
  ).exec();

  await createAuditLog({
    userId: user.id,
    actorId: user.id,
    actorType: user.role === "admin" || user.role === "super_admin" ? "admin" : "user",
    action: "trusted_contact_removed",
    metadata: {
      trustedContactId: trustedContact._id.toString(),
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    message: "Trusted contact removed successfully.",
  };
};

export const getTrustedContactInvitation = async (token: string) => {
  const trustedContact = await findTrustedContactByInviteTokenOrThrow(token);
  const owner = await UserModel.findById(trustedContact.userId).exec();

  return {
    invitation: {
      trustedContact: {
        name: trustedContact.name,
        email: trustedContact.email,
      },
      owner: {
        name: owner?.name ?? "User",
      },
      status: trustedContact.status,
      expiresAt: trustedContact.inviteTokenExpiresAt?.toISOString(),
      accessScope: trustedContact.accessScope,
      inactivityDays: trustedContact.inactivityDays,
    },
  };
};

export const acceptTrustedContactInvitation = async (
  token: string,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const trustedContact = await findTrustedContactByInviteTokenOrThrow(token);

  trustedContact.status = "accepted";
  trustedContact.acceptedAt = new Date();
  trustedContact.inviteTokenHash = undefined;
  trustedContact.inviteTokenExpiresAt = undefined;
  await trustedContact.save();

  await createAuditLog({
    userId: trustedContact.userId.toString(),
    actorType: "trusted_contact",
    action: "trusted_contact_invite_accepted",
    metadata: {
      trustedContactId: trustedContact._id.toString(),
      email: trustedContact.email,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    trustedContact: toPublicTrustedContact(trustedContact),
    message: "Trusted contact invitation accepted.",
  };
};

export const declineTrustedContactInvitation = async (
  token: string,
  audit: { ipAddress?: string; userAgent?: string },
) => {
  const trustedContact = await findTrustedContactByInviteTokenOrThrow(token);

  trustedContact.status = "declined";
  trustedContact.inviteTokenHash = undefined;
  trustedContact.inviteTokenExpiresAt = undefined;
  await trustedContact.save();

  await createAuditLog({
    userId: trustedContact.userId.toString(),
    actorType: "trusted_contact",
    action: "trusted_contact_invite_declined",
    metadata: {
      trustedContactId: trustedContact._id.toString(),
      email: trustedContact.email,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  });

  return {
    message: "Trusted contact invitation declined.",
  };
};
