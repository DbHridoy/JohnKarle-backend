import bcrypt from "bcrypt";
import { Types } from "mongoose";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { sendTransactionalEmail } from "../../utils/mail.util.js";
import { AuditLogModel } from "../audit-logs/audit-log.model.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { requireRecentPasswordReauth } from "../auth/auth.reauth.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { toPublicUser } from "../users/user.presenter.js";
import { deleteProfilePicture, uploadProfilePicture } from "../users/user.upload.js";
import { UserModel } from "../users/user.model.js";
import { EmailTemplateModel } from "../email-templates/email-template.model.js";
import { AdminSettingsModel, adminSettingsKey } from "./admin-settings.model.js";
import type {
  AdminUserIdParams,
  AdminRecentActivitiesQuery,
  AdminUserListQuery,
  BulkEmailInput,
  ChangeAdminPasswordInput,
  CreateEmailTemplateInput,
  CreateAdminInput,
  EmailTemplateIdParams,
  ListEmailTemplatesQuery,
  UpdateEmailTemplateInput,
  UpdateAdminProfileInput,
  UpdateAdminSettingsInput,
} from "./admin.validation.js";

type AdminRecentActivity = {
  id: string;
  type: string;
  message: string;
  actor?: {
    id: string;
    name?: string;
    email?: string;
    role?: string;
  };
  target?: {
    type?: string;
    id?: string;
    label?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SENSITIVE_METADATA_KEYS = new Set([
  "accessToken",
  "authorization",
  "cookie",
  "currentPassword",
  "password",
  "passwordHash",
  "refreshToken",
  "resetToken",
  "secret",
  "token",
  "verificationToken",
]);

const isSensitiveMetadataKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();

  return [...SENSITIVE_METADATA_KEYS].some((sensitiveKey) =>
    normalizedKey.includes(sensitiveKey.toLowerCase()),
  );
};

const sanitizeMetadata = (value: unknown, depth = 0): unknown => {
  if (depth >= 5) {
    return "[Truncated]";
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        isSensitiveMetadataKey(key) ? "[Redacted]" : sanitizeMetadata(entry, depth + 1),
      ]),
    );
  }

  return String(value);
};

const buildActivityMessage = (action: string): string => {
  const messages: Record<string, string> = {
    user_registered: "New user created an account",
    family_invitation_created: "User invited a new family member",
    family_invitation_accepted: "Family invitation accepted",
    family_invitation_declined: "Family invitation declined",
    memory_created: "User created a memory",
    memory_updated: "User updated a memory",
    memory_deleted: "User deleted a memory",
    legacy_access_approved: "Legacy access approved",
    legacy_access_cancelled: "Legacy access request cancelled",
    legacy_access_enabled: "Legacy access settings updated",
    legacy_access_expired: "Legacy access request expired",
    legacy_access_triggered: "Legacy access request created",
    legacy_data_viewed: "Legacy access data viewed",
    report_feedback_admin_reply_added: "Admin replied to a report",
    report_feedback_created: "Report or feedback created",
    report_feedback_status_changed: "Report status changed",
    report_feedback_user_reply_added: "User replied to a report",
    trusted_contact_added: "Trusted contact added",
    trusted_contact_invite_accepted: "Trusted contact invitation accepted",
    trusted_contact_invite_declined: "Trusted contact invitation declined",
    trusted_contact_removed: "Trusted contact removed",
    trusted_contact_updated: "Trusted contact updated",
    admin_user_created: "Admin created a new admin account",
    admin_bulk_email_sent: "Admin sent a bulk email",
  };

  return messages[action] ?? action.replaceAll("_", " ");
};

const toActivityType = (action: string): string =>
  action.replaceAll("_", " ").trim().replace(/\s+/g, "_");

const buildTargetFromAuditLog = (auditLog: {
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
}) => {
  if (auditLog.targetType || auditLog.targetId || auditLog.targetLabel) {
    return {
      ...(auditLog.targetType ? { type: auditLog.targetType } : {}),
      ...(auditLog.targetId ? { id: auditLog.targetId } : {}),
      ...(auditLog.targetLabel ? { label: auditLog.targetLabel } : {}),
    };
  }

  return undefined;
};

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

const toPublicEmailTemplate = (template: {
  _id: { toString(): string };
  templateName: string;
  subjectLine: string;
  content: string;
  createdBy?: { toString(): string } | string;
  updatedBy?: { toString(): string } | string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: template._id.toString(),
  templateName: template.templateName,
  subjectLine: template.subjectLine,
  content: template.content,
  ...(template.createdBy ? { createdBy: template.createdBy.toString() } : {}),
  ...(template.updatedBy ? { updatedBy: template.updatedBy.toString() } : {}),
  createdAt: template.createdAt.toISOString(),
  updatedAt: template.updatedAt.toISOString(),
});

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

export const listRecentActivities = async (query: AdminRecentActivitiesQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (query.type !== undefined) {
    filter.action = query.type;
  }

  if (query.actorId !== undefined) {
    filter.actorId = query.actorId;
  }

  if (query.targetType !== undefined) {
    filter.targetType = query.targetType;
  }

  if (query.targetId !== undefined) {
    filter.targetId = query.targetId;
  }

  if (query.from !== undefined || query.to !== undefined) {
    filter.createdAt = {
      ...(query.from === undefined ? {} : { $gte: query.from }),
      ...(query.to === undefined ? {} : { $lte: query.to }),
    };
  }

  const search = query.search?.trim();

  if (search !== undefined) {
    const escaped = escapeRegExp(search);
    const matchingUsers = await UserModel.find({
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ],
    })
      .select("_id")
      .lean()
      .exec();

    filter.$or = [
      { action: { $regex: escaped, $options: "i" } },
      { targetType: { $regex: escaped, $options: "i" } },
      { targetLabel: { $regex: escaped, $options: "i" } },
      ...(matchingUsers.length > 0
        ? [{ actorId: { $in: matchingUsers.map((user) => user._id) } }]
        : []),
    ];
  }

  const [total, auditLogs] = await Promise.all([
    AuditLogModel.countDocuments(filter).exec(),
    AuditLogModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
  ]);

  const actorIds = [
    ...new Set(auditLogs.map((auditLog) => auditLog.actorId?.toString()).filter(Boolean)),
  ];
  const actors = actorIds.length
    ? await UserModel.find({ _id: { $in: actorIds } })
        .select("name email role")
        .lean()
        .exec()
    : [];
  const actorById = new Map(
    actors.map((actor) => [
      actor._id.toString(),
      {
        id: actor._id.toString(),
        name: actor.name,
        email: actor.email,
        role: actor.role,
      },
    ]),
  );

  const activities: AdminRecentActivity[] = auditLogs.map((auditLog) => ({
    id: auditLog._id.toString(),
    type: toActivityType(auditLog.action),
    message: buildActivityMessage(auditLog.action),
    ...(auditLog.actorId
      ? { actor: actorById.get(auditLog.actorId.toString()) ?? { id: auditLog.actorId.toString() } }
      : {}),
    ...(buildTargetFromAuditLog(auditLog) ? { target: buildTargetFromAuditLog(auditLog) } : {}),
    ...(auditLog.metadata && Object.keys(auditLog.metadata).length > 0
      ? { metadata: sanitizeMetadata(auditLog.metadata) as Record<string, unknown> }
      : {}),
    createdAt: auditLog.createdAt.toISOString(),
  }));

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    activities,
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

export const createEmailTemplate = async (
  authenticatedUser: AuthenticatedUser,
  input: CreateEmailTemplateInput,
) => {
  const templateName = input.templateName.trim();
  const existingTemplate = await EmailTemplateModel.exists({ templateName }).exec();

  if (existingTemplate) {
    throw new ApiError(
      409,
      "An email template with this name already exists.",
      "EMAIL_TEMPLATE_ALREADY_EXISTS",
    );
  }

  const template = await EmailTemplateModel.create({
    templateName,
    subjectLine: input.subjectLine.trim(),
    content: input.content.trim(),
    createdBy: authenticatedUser.id,
    updatedBy: authenticatedUser.id,
  });

  return toPublicEmailTemplate(template);
};

export const listEmailTemplates = async (query: ListEmailTemplatesQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  const search = query.search?.trim();

  if (search !== undefined) {
    const escaped = escapeRegExp(search);
    filter.$or = [
      { templateName: { $regex: escaped, $options: "i" } },
      { subjectLine: { $regex: escaped, $options: "i" } },
      { content: { $regex: escaped, $options: "i" } },
    ];
  }

  const [total, templates] = await Promise.all([
    EmailTemplateModel.countDocuments(filter).exec(),
    EmailTemplateModel.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).exec(),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    templates: templates.map(toPublicEmailTemplate),
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

export const getEmailTemplateById = async (params: EmailTemplateIdParams) => {
  const template = await EmailTemplateModel.findById(params.templateId).exec();

  if (!template) {
    throw new ApiError(404, "Email template not found.", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  return toPublicEmailTemplate(template);
};

export const updateEmailTemplate = async (
  authenticatedUser: AuthenticatedUser,
  params: EmailTemplateIdParams,
  input: UpdateEmailTemplateInput,
) => {
  const template = await EmailTemplateModel.findById(params.templateId).exec();

  if (!template) {
    throw new ApiError(404, "Email template not found.", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  if (input.templateName !== undefined) {
    const templateName = input.templateName.trim();
    const duplicateTemplate = await EmailTemplateModel.exists({
      _id: { $ne: template._id },
      templateName,
    }).exec();

    if (duplicateTemplate) {
      throw new ApiError(
        409,
        "An email template with this name already exists.",
        "EMAIL_TEMPLATE_ALREADY_EXISTS",
      );
    }

    template.templateName = templateName;
  }

  if (input.subjectLine !== undefined) {
    template.subjectLine = input.subjectLine.trim();
  }

  if (input.content !== undefined) {
    template.content = input.content.trim();
  }

  template.updatedBy = new Types.ObjectId(authenticatedUser.id);
  await template.save();

  return toPublicEmailTemplate(template);
};

export const deleteEmailTemplate = async (params: EmailTemplateIdParams) => {
  const template = await EmailTemplateModel.findById(params.templateId).exec();

  if (!template) {
    throw new ApiError(404, "Email template not found.", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  await EmailTemplateModel.deleteOne({ _id: template._id }).exec();

  return {
    message: "Email template deleted successfully.",
  };
};

export const getAdminUserById = async (params: AdminUserIdParams) => {
  const user = await UserModel.findById(params.userId).exec();

  if (!user) {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }

  return toPublicUser(user);
};

export const createAdminUser = async (
  authenticatedUser: AuthenticatedUser,
  input: CreateAdminInput,
) => {
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

  await createAuditLog({
    userId: user._id.toString(),
    actorId: authenticatedUser.id,
    actorType: "admin",
    action: "admin_user_created",
    metadata: {
      email: user.email,
      role: user.role,
    },
    targetType: "user",
    targetId: user._id.toString(),
    targetLabel: user.email,
  });

  return toPublicUser(user);
};

export const sendBulkEmail = async (
  authenticatedUser: AuthenticatedUser,
  input: BulkEmailInput,
) => {
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

  await createAuditLog({
    userId: users[0]?._id.toString() ?? input.userIds[0]!,
    actorId: authenticatedUser.id,
    actorType: "admin",
    action: "admin_bulk_email_sent",
    metadata: {
      requestedCount: uniqueUserIds.length,
      sentCount: users.length,
      subject: input.subject,
    },
    targetType: "bulk_email",
    targetId: uniqueUserIds.join(","),
    targetLabel: input.subject,
  });

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
