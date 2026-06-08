import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { randomBytes, randomUUID } from "node:crypto";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { getMailTransporter } from "../../utils/mail.util.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { toPublicUser } from "./user.presenter.js";
import { UserModel } from "./user.model.js";
import type { FamilyMember } from "./user.types.js";
import { deleteProfilePicture, uploadProfilePicture } from "./user.upload.js";
import type {
  AcceptInvitationInput,
  CreateInvitationInput,
  UpdateProfileInput,
} from "./user.validation.js";

const invitationValidityMs = 24 * 60 * 60 * 1000;

const hashSecret = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const generateInvitationPassword = (): string => {
  const randomSegment = randomBytes(6).toString("base64url");

  return `Invite${randomSegment}9aA`;
};

const buildInvitationLink = (token: string): string =>
  `${env.APP_BASE_URL.replace(/\/$/, "")}/invite?token=${encodeURIComponent(token)}`;

const buildInvitationEmail = (
  inviterName: string,
  inviteeName: string,
  invitationLink: string,
  generatedPassword: string,
): string =>
  [
    `Hello ${inviteeName},`,
    "",
    `${inviterName} invited you to join the application.`,
    `Use this link to accept the invitation: ${invitationLink}`,
    `Your temporary password is: ${generatedPassword}`,
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
  generatedPassword: string,
): Promise<void> => {
  const mailTransporter = getMailTransporter();

  await mailTransporter.sendMail({
    from: env.OUTLOOK_EMAIL,
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

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists.", "EMAIL_ALREADY_EXISTS");
  }

  const generatedPassword = generateInvitationPassword();
  const invitationToken = randomUUID();
  const passwordHash = await bcrypt.hash(generatedPassword, env.BCRYPT_SALT_ROUNDS);
  const invitationExpiresAt = new Date(Date.now() + invitationValidityMs);

  const invitedUser = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
    invitedBy: inviter._id,
    invitationRole: input.role,
    invitationTokenHash: hashSecret(invitationToken),
    invitationExpiresAt,
    familyMembers: [],
  });

  const existingFamilyMemberIndex = inviter.familyMembers.findIndex(
    (member: FamilyMember) => member.email === input.email,
  );
  const previousFamilyMember =
    existingFamilyMemberIndex >= 0 ? inviter.familyMembers[existingFamilyMemberIndex] : undefined;

  if (existingFamilyMemberIndex >= 0) {
    inviter.familyMembers[existingFamilyMemberIndex] = {
      name: input.name,
      email: input.email,
      role: input.role,
    };
  } else {
    inviter.familyMembers.push({
      name: input.name,
      email: input.email,
      role: input.role,
    });
  }

  await inviter.save();

  try {
    await sendInvitationEmail(
      inviter.name,
      invitedUser.name,
      invitedUser.email,
      invitationToken,
      generatedPassword,
    );
  } catch (error) {
    await UserModel.deleteOne({ _id: invitedUser._id }).exec();

    if (previousFamilyMember && existingFamilyMemberIndex >= 0) {
      inviter.familyMembers[existingFamilyMemberIndex] = previousFamilyMember;
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
      email: invitedUser.email,
      expiresAt: invitationExpiresAt.toISOString(),
      role: input.role,
    },
    message: "Invitation sent successfully.",
  };
};

export const acceptInvitation = async (input: AcceptInvitationInput) => {
  const invitationTokenHash = hashSecret(input.token);
  const invitedUser = await UserModel.findOne({
    invitationTokenHash,
  })
    .select("+invitationTokenHash +invitationExpiresAt")
    .exec();

  if (!invitedUser || !invitedUser.invitationTokenHash || !invitedUser.invitationExpiresAt) {
    throw new ApiError(400, "Invitation is invalid.", "INVALID_INVITATION");
  }

  if (invitedUser.invitationExpiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "Invitation has expired.", "INVITATION_EXPIRED");
  }

  invitedUser.invitationTokenHash = undefined;
  invitedUser.invitationExpiresAt = undefined;
  invitedUser.invitationAcceptedAt = new Date();
  invitedUser.isEmailVerified = true;

  await invitedUser.save();

  return {
    email: invitedUser.email,
    message: "Invitation accepted successfully.",
  };
};
