import { z } from "zod";

export const trustedContactIdParamsSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid trusted contact id."),
  })
  .strict();

export const trustedContactInviteTokenParamsSchema = z
  .object({
    token: z.string().trim().min(1),
  })
  .strict();

const accessScopeSchema = z
  .object({
    profile: z.boolean(),
    documents: z.boolean(),
    notes: z.boolean(),
    messages: z.boolean(),
    paymentInfo: z.boolean().default(false),
    accountTransfer: z.boolean().default(false),
  })
  .strict();

const currentPasswordSchema = z.string().min(1).max(128);

export const createTrustedContactBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().min(1).max(30).optional(),
    inactivityDays: z.number().int().min(30).max(365),
    accessScope: accessScopeSchema,
    currentPassword: currentPasswordSchema,
  })
  .strict();

export const updateTrustedContactBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    inactivityDays: z.number().int().min(30).max(365).optional(),
    accessScope: accessScopeSchema.optional(),
    currentPassword: currentPasswordSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.phone !== undefined ||
      value.inactivityDays !== undefined ||
      value.accessScope !== undefined,
    {
      message: "At least one trusted contact field must be updated.",
    },
  );

export const deleteTrustedContactBodySchema = z
  .object({
    currentPassword: currentPasswordSchema,
  })
  .strict();

export type CreateTrustedContactInput = z.infer<typeof createTrustedContactBodySchema>;
export type UpdateTrustedContactInput = z.infer<typeof updateTrustedContactBodySchema>;
export type DeleteTrustedContactInput = z.infer<typeof deleteTrustedContactBodySchema>;
export type TrustedContactIdParams = z.infer<typeof trustedContactIdParamsSchema>;
