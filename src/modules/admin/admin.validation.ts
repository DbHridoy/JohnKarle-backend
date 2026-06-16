import { z } from "zod";

import { emailSchema, passwordSchema } from "../auth/auth.validation.js";
import { userRoles } from "../users/user.types.js";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid user id.");

const genericObjectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier.");

const positiveIntFromQuery = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }

    if (typeof value === "string") {
      return Number.parseInt(value, 10);
    }

    return value;
  }, z.number().int().min(1));

export const adminUserListQuerySchema = z
  .object({
    page: positiveIntFromQuery(1).default(1),
    limit: positiveIntFromQuery(20).pipe(z.number().int().min(1).max(100)).default(20),
    search: z.string().trim().min(1).max(120).optional(),
    role: z.enum(userRoles).optional(),
  })
  .strict();

const isoDateQuerySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }

  return value;
}, z.date());

export const adminRecentActivitiesQuerySchema = z
  .object({
    page: positiveIntFromQuery(1).default(1),
    limit: positiveIntFromQuery(20).pipe(z.number().int().min(1).max(100)).default(20),
    type: z.string().trim().min(1).max(120).optional(),
    actorId: genericObjectIdSchema.optional(),
    targetType: z.string().trim().min(1).max(100).optional(),
    targetId: genericObjectIdSchema.optional(),
    from: isoDateQuerySchema.optional(),
    to: isoDateQuerySchema.optional(),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.from === undefined ||
      value.to === undefined ||
      value.from.getTime() <= value.to.getTime(),
    {
      message: "`from` must be earlier than or equal to `to`.",
      path: ["from"],
    },
  );

export const adminUserIdParamsSchema = z
  .object({
    userId: objectIdSchema,
  })
  .strict();

export const emailTemplateIdParamsSchema = z
  .object({
    templateId: genericObjectIdSchema,
  })
  .strict();

export const createAdminBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema,
    phone: z.string().trim().min(1).max(30).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    profileImage: z.string().trim().url().max(2048).optional(),
  })
  .strict();

export const bulkEmailBodySchema = z
  .object({
    userIds: z.array(objectIdSchema).min(1, "At least one recipient is required.").max(50),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const createEmailTemplateBodySchema = z
  .object({
    templateName: z.string().trim().min(2).max(120),
    subjectLine: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(100_000),
  })
  .strict();

export const listEmailTemplatesQuerySchema = z
  .object({
    page: positiveIntFromQuery(1).default(1),
    limit: positiveIntFromQuery(20).pipe(z.number().int().min(1).max(100)).default(20),
    search: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const updateEmailTemplateBodySchema = z
  .object({
    templateName: z.string().trim().min(2).max(120).optional(),
    subjectLine: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(100_000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.templateName !== undefined ||
      value.subjectLine !== undefined ||
      value.content !== undefined,
    {
      message: "At least one email template field must be updated.",
    },
  );

export const updateAdminProfileBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: emailSchema.optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    profileImage: z.string().trim().url().max(2048).optional(),
  })
  .strict();

export const changeAdminPasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict();

export const updateAdminSettingsBodySchema = z
  .object({
    termsAndConditions: z.string().trim().min(1).max(100_000).optional(),
    privacyPolicy: z.string().trim().min(1).max(100_000).optional(),
    aboutUs: z.string().trim().min(1).max(100_000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.termsAndConditions !== undefined ||
      value.privacyPolicy !== undefined ||
      value.aboutUs !== undefined,
    {
      message: "At least one settings field must be updated.",
    },
  );

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminRecentActivitiesQuery = z.infer<typeof adminRecentActivitiesQuerySchema>;
export type AdminUserIdParams = z.infer<typeof adminUserIdParamsSchema>;
export type EmailTemplateIdParams = z.infer<typeof emailTemplateIdParamsSchema>;
export type CreateAdminInput = z.infer<typeof createAdminBodySchema>;
export type BulkEmailInput = z.infer<typeof bulkEmailBodySchema>;
export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateBodySchema>;
export type ListEmailTemplatesQuery = z.infer<typeof listEmailTemplatesQuerySchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateBodySchema>;
export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileBodySchema>;
export type ChangeAdminPasswordInput = z.infer<typeof changeAdminPasswordBodySchema>;
export type UpdateAdminSettingsInput = z.infer<typeof updateAdminSettingsBodySchema>;
