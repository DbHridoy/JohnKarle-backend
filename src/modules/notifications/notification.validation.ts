import { z } from "zod";

import { notificationPriorities, notificationTypes } from "./notification.types.js";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid notification id.");

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

const booleanFromQuery = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const notificationDataSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 5000, {
    message: "Notification data is too large.",
  });

export const notificationListQuerySchema = z
  .object({
    page: positiveIntFromQuery(1).default(1),
    limit: positiveIntFromQuery(20).pipe(z.number().int().min(1).max(100)).default(20),
    isRead: booleanFromQuery.optional(),
    type: z.enum(notificationTypes).optional(),
    priority: z.enum(notificationPriorities).optional(),
  })
  .strict();

export const notificationIdParamsSchema = z
  .object({
    notificationId: objectIdSchema,
  })
  .strict();

export const adminBroadcastBodySchema = z
  .object({
    recipientIds: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[0-9a-fA-F]{24}$/, "Invalid recipient id."),
      )
      .min(1)
      .max(500)
      .optional(),
    sendToAll: z.boolean().optional().default(false),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(2000),
    type: z.enum(["admin_broadcast", "system"]).optional().default("admin_broadcast"),
    priority: z.enum(notificationPriorities).optional().default("normal"),
    data: notificationDataSchema.optional(),
  })
  .strict()
  .refine((value) => value.sendToAll || value.recipientIds !== undefined, {
    message: "Either sendToAll must be true or recipientIds must be provided.",
    path: ["recipientIds"],
  });

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
export type AdminBroadcastInput = z.infer<typeof adminBroadcastBodySchema>;
