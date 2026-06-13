import bcrypt from "bcrypt";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { sendTransactionalEmail } from "../../utils/mail.util.js";
import { requireRecentPasswordReauth } from "../auth/auth.reauth.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { toPublicUser } from "../users/user.presenter.js";
import { deleteProfilePicture, uploadProfilePicture } from "../users/user.upload.js";
import { UserModel } from "../users/user.model.js";
import { AdminSettingsModel, adminSettingsKey } from "./admin-settings.model.js";
import type {
  AdminUserIdParams,
  AdminUserListQuery,
  BulkEmailInput,
  ChangeAdminPasswordInput,
  CreateAdminInput,
  UpdateAdminProfileInput,
  UpdateAdminSettingsInput,
} from "./admin.validation.js";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildProfilePictureFromUrl = (profileImage: string) => {
  const originalName = profileImage.split("/").pop() || "profile-image";

  return {
    key: profileImage,
    url: profileImage,
    originalName,
    mimeType: "image/*",
    size: 0,
  };
};

const findUserOrThrow = async (userId: string) => {
  const user = await UserModel.findById(userId).exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  return user;
};

export const getDashboardMetrics = async (): Promise<{
  totalUsers: number;
  totalActiveProfiles: number;
}> => {
  const [totalUsers, totalActiveProfiles] = await Promise.all([
    UserModel.countDocuments({}).exec(),
    UserModel.countDocuments({
      lastActiveAt: { $exists: true, $ne: null },
    }).exec(),
  ]);

  return {
    totalUsers,
    totalActiveProfiles,
  };
};

export const listAdminUsers = async (query: AdminUserListQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const search = query.search?.trim();
  const filter: Record<string, unknown> = {};

  if (search !== undefined) {
    filter.$or = [
      { name: { $regex: escapeRegExp(search), $options: "i" } },
      { email: { $regex: escapeRegExp(search), $options: "i" } },
      { phoneNumber: { $regex: escapeRegExp(search), $options: "i" } },
    ];
  }

  if (query.role !== undefined) {
    filter.role = query.role;
  }

  const [total, users] = await Promise.all([
    UserModel.countDocuments(filter).exec(),
    UserModel.find(filter)
      .select(
        "name phoneNumber email role isEmailVerified address profilePicture familyMembers preferences legacyAccessEnabled lastActiveAt lastLoginAt createdAt updatedAt",
      )
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .exec(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    users: users.map(toPublicUser),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

export const getAdminUserById = async (params: AdminUserIdParams) => {
  const user = await UserModel.findById(params.userId).exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  return toPublicUser(user);
};

export const createAdminUser = async (input: CreateAdminInput) => {
  const email = input.email.trim().toLowerCase();
  const existingUser = await UserModel.exists({ email }).exec();

  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists.", "EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const user = await UserModel.create({
    name: input.name.trim(),
    email,
    passwordHash,
    role: "admin",
    ...(input.phone === undefined ? {} : { phoneNumber: input.phone }),
    ...(input.address === undefined ? {} : { address: input.address }),
    ...(input.profileImage === undefined
      ? {}
      : { profilePicture: buildProfilePictureFromUrl(input.profileImage) }),
  });

  return toPublicUser(user);
};

export const sendBulkEmail = async (input: BulkEmailInput) => {
  const uniqueUserIds = [...new Set(input.userIds)];

  if (uniqueUserIds.length === 0) {
    throw new ApiError(400, "At least one recipient is required.", "EMPTY_RECIPIENTS");
  }

  if (uniqueUserIds.length > 50) {
    throw new ApiError(400, "Recipient limit exceeded.", "RECIPIENT_LIMIT_EXCEEDED");
  }

  const users = await UserModel.find({ _id: { $in: uniqueUserIds } }).exec();

  if (users.length !== uniqueUserIds.length) {
    throw new ApiError(404, "One or more users were not found.", "USER_NOT_FOUND");
  }

  try {
    await Promise.all(
      users.map((user) =>
        sendTransactionalEmail({
          to: user.email,
          subject: input.subject,
          text: input.message,
        }),
      ),
    );
  } catch {
    throw new ApiError(502, "Failed to send one or more emails.", "MAIL_SEND_ERROR");
  }

  return {
    requestedCount: uniqueUserIds.length,
    sentCount: users.length,
  };
};

export const getAdminProfile = async (authenticatedUser: AuthenticatedUser) => {
  const user = await findUserOrThrow(authenticatedUser.id);

  return toPublicUser(user);
};

export const updateAdminProfile = async (
  authenticatedUser: AuthenticatedUser,
  input: UpdateAdminProfileInput,
  profilePictureFile?: Express.Multer.File,
) => {
  if (input.email !== undefined) {
    throw new ApiError(400, "Email cannot be updated from this route.", "EMAIL_READ_ONLY");
  }

  if (
    profilePictureFile === undefined &&
    input.name === undefined &&
    input.phone === undefined &&
    input.address === undefined &&
    input.profileImage === undefined
  ) {
    throw new ApiError(
      400,
      "At least one profile field must be updated.",
      "PROFILE_UPDATE_REQUIRED",
    );
  }

  const user = await findUserOrThrow(authenticatedUser.id);
  const previousProfilePicture = user.profilePicture;
  let uploadedProfilePicture: typeof user.profilePicture | undefined;

  try {
    if (profilePictureFile) {
      uploadedProfilePicture = await uploadProfilePicture(authenticatedUser.id, profilePictureFile);
      user.profilePicture = uploadedProfilePicture;
    } else if (input.profileImage !== undefined) {
      user.profilePicture = buildProfilePictureFromUrl(input.profileImage);
    }

    if (input.name !== undefined) {
      user.name = input.name;
    }

    if (input.phone !== undefined) {
      user.phoneNumber = input.phone;
    }

    if (input.address !== undefined) {
      user.address = input.address;
    }

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

export const changeAdminPassword = async (
  authenticatedUser: AuthenticatedUser,
  input: ChangeAdminPasswordInput,
) => {
  await requireRecentPasswordReauth(authenticatedUser.id, input.currentPassword);
  const user = await UserModel.findById(authenticatedUser.id).select("+passwordHash").exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  user.passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_SALT_ROUNDS);
  user.refreshTokenVersion += 1;
  await user.save();

  return {
    message: "Password updated successfully.",
  };
};

export const getAdminSettings = async () => {
  const settings = await AdminSettingsModel.findOne({ key: adminSettingsKey }).exec();

  return {
    ...(settings?.termsAndConditions === undefined
      ? {}
      : { termsAndConditions: settings.termsAndConditions }),
    ...(settings?.privacyPolicy === undefined ? {} : { privacyPolicy: settings.privacyPolicy }),
    ...(settings?.aboutUs === undefined ? {} : { aboutUs: settings.aboutUs }),
    ...(settings?.updatedBy ? { updatedBy: settings.updatedBy.toString() } : {}),
    ...(settings?.createdAt ? { createdAt: settings.createdAt.toISOString() } : {}),
    ...(settings?.updatedAt ? { updatedAt: settings.updatedAt.toISOString() } : {}),
  };
};

export const updateAdminSettings = async (
  authenticatedUser: AuthenticatedUser,
  input: UpdateAdminSettingsInput,
) => {
  const settings = await AdminSettingsModel.findOneAndUpdate(
    { key: adminSettingsKey },
    {
      $set: {
        ...(input.termsAndConditions === undefined
          ? {}
          : { termsAndConditions: input.termsAndConditions }),
        ...(input.privacyPolicy === undefined ? {} : { privacyPolicy: input.privacyPolicy }),
        ...(input.aboutUs === undefined ? {} : { aboutUs: input.aboutUs }),
        updatedBy: authenticatedUser.id,
      },
      $setOnInsert: {
        key: adminSettingsKey,
      },
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
      returnDocument: "after",
    },
  ).exec();

  if (!settings) {
    throw new ApiError(500, "Failed to update settings.", "INTERNAL_SERVER_ERROR");
  }

  return {
    ...(settings.termsAndConditions === undefined
      ? {}
      : { termsAndConditions: settings.termsAndConditions }),
    ...(settings.privacyPolicy === undefined ? {} : { privacyPolicy: settings.privacyPolicy }),
    ...(settings.aboutUs === undefined ? {} : { aboutUs: settings.aboutUs }),
    ...(settings.updatedBy ? { updatedBy: settings.updatedBy.toString() } : {}),
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
};
