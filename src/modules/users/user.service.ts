import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { sendTransactionalEmail } from "../../utils/mail.util.js";
import { generateSecureToken, hashToken, verifyTokenHash } from "../../utils/token.util.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { toPublicUser } from "./user.presenter.js";
import {
  createAcceptedFamilyMembership,
  listFamilyMembersForUser,
  areAcceptedFamilyMembers,
} from "./user-family-membership.service.js";
import {
  UserFamilyInvitationModel,
  type UserFamilyInvitationDocument,
} from "./user-family-invitation.model.js";
import { UserModel, type UserDocument } from "./user.model.js";
import type { FamilyMember } from "./user.types.js";
import { deleteProfilePicture, uploadProfilePicture } from "./user.upload.js";
import type {
  AcceptInvitationInput,
  CreateInvitationInput,
  FamilyInvitationParams,
  UpdateProfileInput,
} from "./user.validation.js";

const invitationValidityMs = 24 * 60 * 60 * 1000;

const generateInvitationPassword = (): string => {
  const randomSegment = randomBytes(6).toString("base64url");

  return `Invite${randomSegment}9aA`;
};

const setFamilyMemberEntry = (
  user: Awaited<ReturnType<typeof findUserOrThrow>>,
  entry: FamilyMember,
): FamilyMember | undefined => {
  const existingFamilyMemberIndex = user.familyMembers.findIndex(
    (member: FamilyMember) =>
      (entry.userId !== undefined && member.userId === entry.userId) ||
      member.email === entry.email,
  );
  const previousFamilyMember =
    existingFamilyMemberIndex >= 0 ? user.familyMembers[existingFamilyMemberIndex] : undefined;

  if (existingFamilyMemberIndex >= 0) {
    user.familyMembers[existingFamilyMemberIndex] = entry;
  } else {
    user.familyMembers.push(entry);
  }

  return previousFamilyMember;
};

const buildInvitationLink = (token: string): string =>
  `${env.APP_BASE_URL.replace(/\/$/, "")}/invite?token=${encodeURIComponent(token)}`;

const buildInvitationEmail = (
  inviterName: string,
  inviteeName: string,
  invitationLink: string,
  generatedPassword?: string,
): string =>
  [
    `Hello ${inviteeName},`,
    "",
    `${inviterName} invited you to become a family member in the application.`,
    `Use this link to accept the invitation: ${invitationLink}`,
    ...(generatedPassword ? [`Your temporary password is: ${generatedPassword}`] : []),
    "This invitation expires in 24 hours.",
  ].join("\n");

const findUserOrThrow = async (userId: string) => {
  const user = await UserModel.findById(userId).exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  return user;
};

const sendInvitationEmail = async (
  inviterName: string,
  inviteeName: string,
  inviteeEmail: string,
  invitationToken: string,
  generatedPassword?: string,
): Promise<void> => {
  await sendTransactionalEmail({
    to: inviteeEmail,
    subject: "You have been invited",
    text: buildInvitationEmail(
      inviterName,
      inviteeName,
      buildInvitationLink(invitationToken),
      generatedPassword,
    ),
  });
};

const syncAcceptedLegacyFamilyMembers = (
  inviter: UserDocument,
  invitedUser: UserDocument,
  invitation: UserFamilyInvitationDocument,
): void => {
  setFamilyMemberEntry(inviter, {
    userId: invitedUser._id.toString(),
    name: invitedUser.name,
    email: invitedUser.email,
    relation: invitation.relation,
    role: invitation.role,
    status: "accepted",
  });

  setFamilyMemberEntry(invitedUser, {
    userId: inviter._id.toString(),
    name: inviter.name,
    email: inviter.email,
    relation: invitation.relation,
    role: invitation.role,
    status: "accepted",
  });
};

const finalizeAcceptedInvitation = async (
  invitation: UserFamilyInvitationDocument,
  invitedUser: UserDocument,
  inviter: UserDocument,
): Promise<void> => {
  const acceptedAt = new Date();

  invitation.status = "accepted";
  invitation.acceptedAt = acceptedAt;

  await createAcceptedFamilyMembership({
    requesterId: inviter._id,
    recipientId: invitedUser._id,
    requesterRelationship: invitation.relation,
    recipientRelationship: invitation.relation,
    requesterRole: invitation.role,
    recipientRole: invitation.role,
    sourceInvitationId: invitation._id,
    acceptedAt,
  });

  syncAcceptedLegacyFamilyMembers(inviter, invitedUser, invitation);

  await inviter.save();
  await invitedUser.save();
  await invitation.save();
};

const removePendingFamilyMemberEntry = (
  inviter: Awaited<ReturnType<typeof findUserOrThrow>>,
  inviteeEmail: string,
): void => {
  inviter.familyMembers = inviter.familyMembers.filter(
    (member: FamilyMember) => !(member.email === inviteeEmail && member.status === "pending"),
  );
};

export const getProfile = async (authenticatedUser: AuthenticatedUser) => {
  const user = await findUserOrThrow(authenticatedUser.id);

  return toPublicUser(user);
};

export const updateProfile = async (
  authenticatedUser: AuthenticatedUser,
  input: UpdateProfileInput,
  profilePictureFile?: Express.Multer.File,
) => {
  const user = await findUserOrThrow(authenticatedUser.id);
  const previousProfilePicture = user.profilePicture;
  let uploadedProfilePicture: typeof user.profilePicture | undefined;

  try {
    if (profilePictureFile) {
      uploadedProfilePicture = await uploadProfilePicture(authenticatedUser.id, profilePictureFile);
      user.profilePicture = uploadedProfilePicture;
    }

    if (input.name !== undefined) {
      user.name = input.name;
    }

    if (input.phoneNumber !== undefined) {
      user.phoneNumber = input.phoneNumber;
    }

    if (input.address !== undefined) {
      user.address = input.address;
    }

    if (input.familyMembers !== undefined) {
      user.familyMembers = input.familyMembers;
    }

    user.preferences = {
      ...user.preferences,
      ...(input.notifications === undefined ? {} : { notifications: input.notifications }),
      ...(input.aiInsight === undefined ? {} : { aiInsight: input.aiInsight }),
      ...(input.darkMode === undefined ? {} : { darkMode: input.darkMode }),
      ...(input.anonymousAnalytics === undefined
        ? {}
        : { anonymousAnalytics: input.anonymousAnalytics }),
    };

    await user.save();

    if (profilePictureFile && previousProfilePicture) {
      await deleteProfilePicture(previousProfilePicture).catch(() => undefined);
    }

    return toPublicUser(user);
  } catch (error) {
    await deleteProfilePicture(uploadedProfilePicture).catch(() => undefined);
    throw error;
  }
};

export const createInvitation = async (
  authenticatedUser: AuthenticatedUser,
  input: CreateInvitationInput,
) => {
  const inviter = await findUserOrThrow(authenticatedUser.id);
  const existingUser = await UserModel.findOne({ email: input.email }).exec();

  if (input.email === inviter.email) {
    throw new ApiError(400, "You cannot add yourself as a family member.", "SELF_FAMILY_INVITE");
  }

  if (
    existingUser &&
    (await areAcceptedFamilyMembers(inviter._id.toString(), existingUser._id.toString()))
  ) {
    throw new ApiError(
      409,
      "This family member has already accepted the invitation.",
      "FAMILY_MEMBER_ALREADY_EXISTS",
    );
  }

  const existingPendingInvitation = await UserFamilyInvitationModel.exists({
    inviterId: inviter._id,
    inviteeEmail: input.email,
    status: "pending",
  }).exec();

  if (existingPendingInvitation) {
    throw new ApiError(
      409,
      "A pending invitation already exists for this family member.",
      "INVITATION_ALREADY_EXISTS",
    );
  }

  const invitationToken = generateSecureToken();
  const invitationTokenHash = hashToken(invitationToken);
  const invitationExpiresAt = new Date(Date.now() + invitationValidityMs);

  let invitedUser = existingUser;
  let generatedPassword: string | undefined;

  if (!existingUser) {
    generatedPassword = generateInvitationPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, env.BCRYPT_SALT_ROUNDS);

    invitedUser = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
      invitedBy: inviter._id,
      invitationRole: input.role,
      invitationTokenHash: invitationTokenHash,
      invitationExpiresAt,
      familyMembers: [],
    });
  }

  const familyMemberEntry: FamilyMember = {
    ...(invitedUser ? { userId: invitedUser._id.toString() } : {}),
    name: invitedUser?.name ?? input.name,
    email: input.email,
    relation: input.relation,
    role: input.role,
    status: "pending",
  };
  const previousFamilyMember = setFamilyMemberEntry(inviter, familyMemberEntry);

  const invitation = await UserFamilyInvitationModel.create({
    inviterId: inviter._id,
    ...(invitedUser ? { inviteeUserId: invitedUser._id } : {}),
    inviteeEmail: input.email,
    inviteeName: invitedUser?.name ?? input.name,
    relation: input.relation,
    role: input.role,
    tokenHash: invitationTokenHash,
    expiresAt: invitationExpiresAt,
    status: "pending",
  });

  await inviter.save();

  try {
    await sendInvitationEmail(
      inviter.name,
      invitedUser?.name ?? input.name,
      input.email,
      invitationToken,
      generatedPassword,
    );
  } catch (error) {
    await UserFamilyInvitationModel.deleteOne({ _id: invitation._id }).exec();

    if (!existingUser && invitedUser) {
      await UserModel.deleteOne({ _id: invitedUser._id }).exec();
    }

    if (previousFamilyMember) {
      setFamilyMemberEntry(inviter, previousFamilyMember);
    } else {
      inviter.familyMembers = inviter.familyMembers.filter(
        (member: FamilyMember) => member.email !== input.email,
      );
    }

    await inviter.save();
    throw error;
  }

  return {
    invitation: {
      email: input.email,
      expiresAt: invitationExpiresAt.toISOString(),
      role: input.role,
      status: "pending",
      isExistingUser: Boolean(existingUser),
    },
    message: "Invitation sent successfully.",
  };
};

export const acceptInvitation = async (input: AcceptInvitationInput) => {
  const invitation = await UserFamilyInvitationModel.findOne({
    tokenHash: hashToken(input.token),
    status: "pending",
  })
    .select("+tokenHash +expiresAt")
    .exec();

  if (!invitation || !verifyTokenHash(input.token, invitation.tokenHash)) {
    throw new ApiError(400, "Invitation is invalid.", "INVALID_INVITATION");
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ApiError(400, "Invitation has expired.", "INVITATION_EXPIRED");
  }

  const invitedUser =
    (invitation.inviteeUserId ? await UserModel.findById(invitation.inviteeUserId).exec() : null) ??
    (await UserModel.findOne({ email: invitation.inviteeEmail })
      .select("+invitationTokenHash +invitationExpiresAt")
      .exec());
  const inviter = await UserModel.findById(invitation.inviterId).exec();

  if (!invitedUser || !inviter) {
    throw new ApiError(404, "Invitation is no longer valid.", "INVALID_INVITATION");
  }

  if (
    invitedUser.invitationTokenHash &&
    verifyTokenHash(input.token, invitedUser.invitationTokenHash)
  ) {
    invitedUser.invitationTokenHash = undefined;
    invitedUser.invitationExpiresAt = undefined;
    invitedUser.invitationAcceptedAt = new Date();
    invitedUser.isEmailVerified = true;
  }

  await finalizeAcceptedInvitation(invitation, invitedUser, inviter);

  return {
    email: invitedUser.email,
    message: "Invitation accepted successfully.",
  };
};

export const listInvitations = async (authenticatedUser: AuthenticatedUser) => {
  const invitations = await UserFamilyInvitationModel.find({
    $or: [{ inviteeUserId: authenticatedUser.id }, { inviteeEmail: authenticatedUser.email }],
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .exec();

  return invitations.map((invitation) => ({
    id: invitation._id.toString(),
    inviterId: invitation.inviterId.toString(),
    ...(invitation.inviteeUserId ? { inviteeUserId: invitation.inviteeUserId.toString() } : {}),
    inviteeEmail: invitation.inviteeEmail,
    inviteeName: invitation.inviteeName,
    relation: invitation.relation,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString(),
  }));
};

export const acceptInvitationById = async (
  authenticatedUser: AuthenticatedUser,
  params: FamilyInvitationParams,
) => {
  const invitation = await UserFamilyInvitationModel.findOne({
    _id: params.invitationId,
    $or: [{ inviteeUserId: authenticatedUser.id }, { inviteeEmail: authenticatedUser.email }],
    status: "pending",
  })
    .select("+tokenHash +expiresAt")
    .exec();

  if (!invitation) {
    throw new ApiError(404, "Invitation not found.", "INVITATION_NOT_FOUND");
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ApiError(400, "Invitation has expired.", "INVITATION_EXPIRED");
  }

  const invitedUser =
    (invitation.inviteeUserId ? await UserModel.findById(invitation.inviteeUserId).exec() : null) ??
    (await UserModel.findOne({ email: invitation.inviteeEmail })
      .select("+invitationTokenHash +invitationExpiresAt")
      .exec());
  const inviter = await UserModel.findById(invitation.inviterId).exec();

  if (!invitedUser || !inviter) {
    throw new ApiError(404, "Invitation is no longer valid.", "INVALID_INVITATION");
  }

  await finalizeAcceptedInvitation(invitation, invitedUser, inviter);

  return {
    email: invitedUser.email,
    message: "Invitation accepted successfully.",
  };
};

export const declineInvitationById = async (
  authenticatedUser: AuthenticatedUser,
  params: FamilyInvitationParams,
) => {
  const invitation = await UserFamilyInvitationModel.findOne({
    _id: params.invitationId,
    $or: [{ inviteeUserId: authenticatedUser.id }, { inviteeEmail: authenticatedUser.email }],
    status: "pending",
  }).exec();

  if (!invitation) {
    throw new ApiError(404, "Invitation not found.", "INVITATION_NOT_FOUND");
  }

  invitation.status = "declined";
  await invitation.save();

  const inviter = await UserModel.findById(invitation.inviterId).exec();

  if (inviter) {
    removePendingFamilyMemberEntry(inviter, invitation.inviteeEmail);
    await inviter.save();
  }

  return {
    message: "Invitation declined successfully.",
  };
};

export const listFamilyMembers = async (authenticatedUser: AuthenticatedUser) =>
  listFamilyMembersForUser(authenticatedUser.id);
